'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LiveMap, type MapMarker } from '@/components/map/LiveMap';
import { Callout, Spinner } from '@/app/(portal)/jobs/new/_components/ui';
import { acceptJob, currentPosition, getToken, openJobs, sendLocation, ServerApiError, signIn, signOut, type ServerJob } from '@/lib/server/api';

const POLL_MS = 10_000;
const LOCATION_EVERY_MS = 15_000;

export function ServerHome() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => setSignedIn(Boolean(getToken())), []);

  if (signedIn === null) return null;
  if (!signedIn) return <SignIn onDone={() => setSignedIn(true)} />;
  return <Dashboard onSignOut={() => { signOut(); setSignedIn(false); }} />;
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      onDone();
    } catch (err) {
      setError(err instanceof ServerApiError ? err.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 flex flex-col gap-3 p-5">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-[14px] text-muted">Use the email and password ServeNow gave you.</p>
      <label className="flex flex-col gap-1 text-[14px]">
        Email
        <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1 text-[14px]">
        Password
        <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error ? <Callout tone="bad">{error}</Callout> : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<ServerJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
  const watchId = useRef<number | null>(null);

  // Load open jobs now and then keep them fresh.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const items = await openJobs();
        if (alive) {
          setJobs(items);
          setError(null);
        }
      } catch (err) {
        if (!alive) return;
        if (err instanceof ServerApiError && err.status === 401) return onSignOut();
        setError(err instanceof Error ? err.message : 'Could not load jobs.');
      }
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [onSignOut]);

  // Going online shares this phone's location, so jobs can be sorted by distance.
  useEffect(() => {
    if (!online) return;
    if (!('geolocation' in navigator)) return setLocationNote('This phone cannot share its location.');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationNote(null);
      },
      () => setLocationNote('Allow location for this site so we can show jobs near you.'),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    const send = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => void sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy).catch(() => undefined),
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    };
    send();
    const t = setInterval(send, LOCATION_EVERY_MS);
    return () => {
      clearInterval(t);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    };
  }, [online]);

  async function accept(job: ServerJob) {
    setAccepting(job.id);
    setError(null);
    try {
      await acceptJob(job.id);
      router.push(`/server/jobs/?id=${encodeURIComponent(job.id)}`);
    } catch (err) {
      setError(err instanceof ServerApiError && err.status === 409 ? 'Another server just accepted this job.' : err instanceof Error ? err.message : 'Could not accept.');
      setAccepting(null);
      setJobs(await openJobs().catch(() => jobs));
    }
  }

  const markers: MapMarker[] = [];
  if (here) markers.push({ id: 'me', position: here, kind: 'server-available', label: 'You', title: 'You are here' });
  for (const j of jobs ?? []) {
    const addr = j.recipients[0]?.addresses[0];
    if (addr) markers.push({ id: j.id, position: addr.location, kind: 'target', title: `${j.recipients[0]?.name ?? 'Job'} · ${addr.formatted}` });
  }
  const center = here ?? jobs?.[0]?.recipients[0]?.addresses[0]?.location ?? { lat: 45.4215, lng: -75.6972 };

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-[15px] font-semibold">{online ? 'You are online' : 'You are offline'}</div>
          <div className="text-[13px] text-muted">{online ? 'Showing jobs nearest to you.' : 'Go online to see jobs sorted by distance.'}</div>
        </div>
        <button type="button" className={`btn ${online ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setOnline((o) => !o)}>
          {online ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {locationNote ? <Callout tone="warn">{locationNote}</Callout> : null}
      {error ? <Callout tone="bad">{error}</Callout> : null}

      <div className="relative h-[52vh] min-h-[320px] overflow-hidden rounded-2xl border border-line">
        <div className="absolute inset-0 isolate">
          <LiveMap className="h-full w-full rounded-none border-0" center={center} zoom={13} markers={markers} ariaLabel="Map of open jobs" />
        </div>
      </div>

      <section className="card overflow-hidden">
        <button type="button" className="flex w-full items-center justify-between p-4 text-left font-semibold" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
          Open jobs {jobs ? `(${jobs.length})` : ''}
          <span className="text-[13px] font-normal text-muted">{sheetOpen ? 'Hide' : 'Show'}</span>
        </button>
        {sheetOpen ? (
          <div className="border-t border-line">
            {jobs === null ? (
              <div className="flex items-center gap-2 p-4 text-muted">
                <Spinner /> Loading jobs…
              </div>
            ) : jobs.length === 0 ? (
              <p className="p-4 text-[14px] text-muted">No open jobs right now. This list refreshes by itself.</p>
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => {
                  const addr = j.recipients[0]?.addresses[0];
                  return (
                    <li key={j.id} className="flex flex-col gap-2 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold">{j.recipients[0]?.name ?? 'Job'}</div>
                        <div className="shrink-0 text-[13px] tabular-nums text-muted">{j.distanceM != null ? formatDistance(j.distanceM) : '—'}</div>
                      </div>
                      <div className="text-[13px] text-muted">{addr?.formatted ?? 'Address to follow'}</div>
                      <div className="text-[12.5px] text-faint">
                        {j.priority.replace('_', ' ')} · due {new Date(j.dueBy).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                      </div>
                      <button type="button" className="btn btn-primary" disabled={accepting !== null} onClick={() => void accept(j)}>
                        {accepting === j.id ? 'Accepting…' : 'Accept job'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${m} m away` : `${(m / 1000).toFixed(1)} km away`;
}
