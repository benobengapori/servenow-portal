'use client';

import { useMemo } from 'react';
import { LiveMap, type MapCircle, type MapLine, type MapMarker } from '@/components/map/LiveMap';
import type { Attempt, GeoPoint, JobStatus } from '@/types/jobs';
import { Icon, ProgressBar, Spinner } from '../../new/_components/ui';
import { offset, seededRandom } from '../_lib/geo';
import { useDispatch, type DispatchMode, type SimServer } from '../_lib/useDispatch';

const OUTCOME_LABEL: Record<Attempt['outcome'], string> = {
  served_personal: 'Served personally',
  served_substituted: 'Served (alternative, at residence)',
  served_corporate: 'Served on the corporation',
  no_answer: 'No answer',
  refused: 'Refused',
  moved: 'Moved',
  bad_address: 'Bad address',
  evading: 'Evading',
  vacant: 'Vacant',
  deceased: 'Deceased',
  other: 'Other',
};

export function modeFor(status: JobStatus): DispatchMode | 'history' {
  if (['submitted', 'authorized', 'open', 'offered'].includes(status)) return 'search';
  if (status === 'assigned') return 'en_route';
  if (status === 'in_progress') return 'at_door';
  return 'history';
}

interface Props {
  jobId: string;
  status: JobStatus;
  target: GeoPoint;
  address: string;
  attempts: readonly Attempt[];
  assignedServerName: string | null;
}

export function TrackingMap(props: Props) {
  const mode = modeFor(props.status);
  return mode === 'history' ? <HistoryMap {...props} /> : <LiveDispatch {...props} mode={mode} />;
}

/* ── Live: dispatching or en route ── */
function LiveDispatch({ jobId, target, address, attempts, assignedServerName, mode }: Props & { mode: DispatchMode }) {
  const { servers, phase, route, widen, keepWaiting } = useDispatch(target, jobId, mode, assignedServerName);

  const markers = useMemo<MapMarker[]>(() => {
    const searching = phase.kind === 'searching' || (phase.kind === 'none_available' && phase.waiting);
    const list: MapMarker[] = [{ id: 'target', position: target, kind: searching ? 'target-searching' : 'target', title: address }];
    for (const s of servers) {
      list.push({ id: s.id, position: s.position, kind: `server-${s.state}`, label: s.initials, title: `${s.name} · ${STATE_TEXT[s.state]}` });
    }
    for (const a of attemptMarkers(attempts, target, jobId)) list.push(a.marker);
    return list;
  }, [servers, phase, target, address, attempts, jobId]);

  const circles = useMemo<MapCircle[]>(
    () => (phase.kind === 'searching' || phase.kind === 'none_available' ? [{ id: 'search', center: target, radiusM: phase.radiusKm * 1000, kind: 'search' }] : []),
    [phase, target],
  );

  const lines = useMemo<MapLine[]>(() => {
    if (phase.kind === 'searching') {
      return servers.filter((s) => s.state === 'offered').map((s) => ({ id: `offer-${s.id}`, points: [target, s.position], kind: 'offer' as const }));
    }
    if (route) return [{ id: 'route', points: route, kind: 'route' }];
    return [];
  }, [phase, servers, route, target]);

  // Re-fit when the story moves to a new stage, not every tick.
  const fitKey = phase.kind === 'searching' ? `search-${phase.round}` : phase.kind;
  const fitPoints = useMemo(() => {
    if (phase.kind === 'searching' || phase.kind === 'none_available') {
      const r = phase.radiusKm * 1000;
      return [offset(target, r, 0), offset(target, r, 90), offset(target, r, 180), offset(target, r, 270)];
    }
    if (phase.kind === 'en_route') {
      const s = servers.find((x) => x.id === phase.serverId);
      return s ? [target, s.position] : [target];
    }
    return [target];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return (
    <div className="card overflow-hidden">
      <LiveMap
        className="h-[min(56vh,420px)] w-full rounded-none border-0 border-b"
        center={target}
        zoom={13}
        markers={markers}
        circles={circles}
        lines={lines}
        fit={{ key: fitKey, points: fitPoints, maxZoom: phase.kind === 'arrived' ? 17 : 15 }}
        ariaLabel={`Live map for the service address ${address}`}
      />
      <DispatchPanel phase={phase} servers={servers} attemptsSoFar={attempts.length} onWiden={widen} onWait={keepWaiting} />
      <Legend />
    </div>
  );
}

const STATE_TEXT: Record<SimServer['state'], string> = {
  available: 'available',
  busy: 'on another job',
  offered: 'offered this job',
  declined: 'didn’t accept',
  assigned: 'assigned to this job',
};

function DispatchPanel({
  phase,
  servers,
  attemptsSoFar,
  onWiden,
  onWait,
}: {
  phase: ReturnType<typeof useDispatch>['phase'];
  servers: readonly SimServer[];
  attemptsSoFar: number;
  onWiden: () => void;
  onWait: () => void;
}) {
  if (phase.kind === 'searching') {
    const offered = servers.filter((s) => phase.offeredIds.includes(s.id));
    return (
      <div className="flex flex-col gap-2 p-4" aria-live="polite">
        <div className="flex items-center gap-2 font-semibold">
          <Spinner /> Finding a process server
        </div>
        <div className="text-[13px] text-muted">
          {offered.length
            ? `Offered to ${offered.length} server${offered.length > 1 ? 's' : ''} within ${phase.radiusKm} km · waiting for a reply (0:0${Math.max(0, phase.secondsLeft)})`
            : `No available servers within ${phase.radiusKm} km · moving to the next round`}
        </div>
        {offered.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {offered.map((s) => (
              <li key={s.id} className="rounded bg-info-bg px-2 py-0.5 text-[12px] text-info">
                {s.name}
              </li>
            ))}
          </ul>
        ) : null}
        <ProgressBar value={(6 - phase.secondsLeft) / 6} />
      </div>
    );
  }

  if (phase.kind === 'none_available') {
    return (
      <div className="flex flex-col gap-3 p-4" aria-live="polite">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-warn-bg text-warn">
              <Icon name="alert" className="h-3.5 w-3.5" />
            </span>
            No server available right now
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {phase.offered} servers within {phase.radiusKm} km were offered this job and didn’t accept, and {phase.busy} more are on other jobs.{' '}
            {phase.waiting ? 'We’ll keep offering it every 10 minutes and notify you the moment someone accepts.' : 'You can wait or reach servers farther away.'}
          </p>
        </div>
        {!phase.waiting ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={onWiden}>
              Widen search to 25 km
            </button>
            <button type="button" className="btn btn-ghost" onClick={onWait}>
              Keep waiting
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost self-start" onClick={onWiden}>
            Widen search to 25 km instead
          </button>
        )}
        <div className="text-[11.5px] text-faint">Servers farther away may add a travel charge. You’ll see the new price before anything is billed.</div>
      </div>
    );
  }

  const server = servers.find((s) => s.id === phase.serverId);
  const card = server ? (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#101a2b] text-[12px] font-bold text-white">{server.initials}</div>
      <div className="min-w-0">
        <div className="font-semibold">{server.name}</div>
        <div className="text-[12px] text-muted">
          ★ {server.rating.toFixed(1)} · {server.jobsDone} jobs · ID and background verified
        </div>
      </div>
    </div>
  ) : null;

  if (phase.kind === 'en_route') {
    return (
      <div className="flex flex-col gap-3 p-4" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-semibold">On the way to the address</div>
          <div className="text-[13px] tabular-nums text-muted">
            ~{phase.etaMin} min · attempt {attemptsSoFar + 1}
          </div>
        </div>
        <ProgressBar value={phase.progress} />
        {card}
        <div className="text-[11.5px] text-faint">You’ll see the result and the GPS-stamped photo here as soon as the attempt is logged.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4" aria-live="polite">
      <div className="flex items-center gap-2 font-semibold">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok" />
        </span>
        At the address · attempt {attemptsSoFar + 1} in progress
      </div>
      {card}
    </div>
  );
}

function Legend() {
  const item = (cls: string, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11.5px] text-faint">
      {item('bg-[#1f4f8f]', 'Service address')}
      {item('bg-[#1d6b45]', 'Available')}
      {item('bg-[#2f6fc4]', 'Offered')}
      {item('bg-[#8791a1]', 'Busy / declined')}
      {item('bg-[#101a2b]', 'Your server')}
    </div>
  );
}

/* ── History: where each attempt happened ── */
function attemptMarkers(attempts: readonly Attempt[], target: GeoPoint, seed: string) {
  const r = seededRandom(`${seed}:gps`);
  return attempts.map((a, i) => {
    const pos = offset(target, a.distanceFromAddressM ?? 10, r() * 360);
    const flagged = a.flags.includes('distance_exceeded');
    const kind: MapMarker['kind'] = flagged ? 'attempt-flagged' : a.outcome.startsWith('served_') ? 'attempt-served' : 'attempt';
    return {
      attempt: a,
      position: pos,
      marker: { id: `att-${a.id}`, position: pos, kind, label: String(i + 1), title: `Attempt ${i + 1}: ${OUTCOME_LABEL[a.outcome]} · ${a.distanceFromAddressM ?? '?'} m from the address` } satisfies MapMarker,
    };
  });
}

function HistoryMap({ jobId, status, target, address, attempts }: Props) {
  const points = useMemo(() => attemptMarkers(attempts, target, jobId), [attempts, target, jobId]);
  const markers: MapMarker[] = [{ id: 'target', position: target, kind: 'target', title: address }, ...points.map((p) => p.marker)];
  const lines: MapLine[] = points
    .filter((p) => p.attempt.flags.includes('distance_exceeded'))
    .map((p) => ({ id: `gps-${p.attempt.id}`, points: [target, p.position], kind: 'gps-offset' }));
  const flagged = points.find((p) => p.attempt.flags.includes('distance_exceeded'));
  const served = points.find((p) => p.attempt.outcome.startsWith('served_'));

  return (
    <div className="card overflow-hidden">
      <LiveMap
        className="h-[min(48vh,360px)] w-full rounded-none border-0 border-b"
        center={target}
        zoom={16}
        markers={markers}
        lines={lines}
        fit={{ key: 'history', points: [target, ...points.map((p) => p.position)], maxZoom: 17 }}
        ariaLabel={`Map of attempts at ${address}`}
      />
      <div className="flex flex-col gap-1 p-4 text-[13px]">
        {flagged ? (
          <>
            <div className="font-semibold text-bad">GPS point {flagged.attempt.distanceFromAddressM} m from the address</div>
            <div className="text-muted">The phone’s location when service was recorded doesn’t match the service address. This is why the job is under review.</div>
          </>
        ) : served ? (
          <>
            <div className="font-semibold text-ok">Served {served.attempt.distanceFromAddressM} m from the address</div>
            <div className="text-muted">Each numbered pin is where the server’s phone was when the attempt was logged.</div>
          </>
        ) : status === 'non_served' ? (
          <>
            <div className="font-semibold text-warn">Not served after {attempts.length} attempts</div>
            <div className="text-muted">The affidavit of attempted service supports a motion for substituted service.</div>
          </>
        ) : (
          <div className="text-muted">{address}</div>
        )}
      </div>
    </div>
  );
}

export { OUTCOME_LABEL };
