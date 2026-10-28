'use client';

/**
 * Demo dispatch simulation for the job tracking map.
 *
 * In production these events arrive from the API over a WebSocket (offers sent, declines,
 * acceptance, the assigned server's location every few seconds). Here they're simulated
 * deterministically per job, so the demo always tells the same story:
 *   round 1 (5 km) → nobody accepts → round 2 (10 km) → nobody accepts → "No server available"
 *   → client widens to 25 km → a server accepts → drives to the address → arrives.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoPoint } from '@/types/jobs';
import { along, distanceM, offset, remaining, seededRandom, streetPath } from './geo';

export type ServerState = 'available' | 'busy' | 'offered' | 'declined' | 'assigned';

export interface SimServer {
  id: string;
  name: string;
  initials: string;
  position: GeoPoint;
  state: ServerState;
  rating: number;
  jobsDone: number;
}

export type DispatchPhase =
  | { kind: 'searching'; round: 1 | 2 | 3; radiusKm: number; offeredIds: string[]; secondsLeft: number }
  | { kind: 'none_available'; radiusKm: number; offered: number; busy: number; waiting: boolean }
  | { kind: 'en_route'; serverId: string; etaMin: number; progress: number }
  | { kind: 'arrived'; serverId: string };

export type DispatchMode = 'search' | 'en_route' | 'at_door';

const POOL = [
  { name: 'Rahel Okafor', km: 2.6, bearing: 40, busy: false },
  { name: 'Marc Jean-Baptiste', km: 1.4, bearing: 160, busy: true },
  { name: 'Sophie Nguyen', km: 4.1, bearing: 250, busy: false },
  { name: 'Layla Haddad', km: 3.3, bearing: 320, busy: true },
  { name: 'Priya Desai', km: 7.2, bearing: 110, busy: false },
  { name: 'Owen MacLeod', km: 5.8, bearing: 205, busy: true },
  { name: 'Yusuf Abdi', km: 9.0, bearing: 15, busy: false },
];
const FAR_SERVER = { name: 'Denis Tremblay', km: 13.5, bearing: 290 };

const ROUND_SECONDS = 6;
const DRIVE_SECONDS = 45;
const DRIVE_MINUTES = 22;

const initialsOf = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

interface SimState {
  t: number; // seconds in the current phase
  servers: SimServer[];
  phase: DispatchPhase;
  route: GeoPoint[] | null;
}

function makePool(target: GeoPoint, seed: string): SimServer[] {
  const r = seededRandom(seed);
  return POOL.map((p, i) => ({
    id: `srv${i}`,
    name: p.name,
    initials: initialsOf(p.name),
    position: offset(target, p.km * 1000 * (0.9 + r() * 0.2), p.bearing + (r() - 0.5) * 40),
    state: p.busy ? 'busy' : 'available',
    rating: 4.6 + Math.round(r() * 4) / 10,
    jobsDone: 40 + Math.floor(r() * 260),
  }));
}

function within(target: GeoPoint, servers: SimServer[], km: number, states: ServerState[]) {
  return servers.filter((s) => states.includes(s.state) && distanceM(target, s.position) <= km * 1000);
}

function startRound(state: SimState, target: GeoPoint, round: 1 | 2 | 3, radiusKm: number): SimState {
  const candidates = within(target, state.servers, radiusKm, ['available']);
  const ids = candidates.map((c) => c.id);
  return {
    ...state,
    t: 0,
    servers: state.servers.map((s) => (ids.includes(s.id) ? { ...s, state: 'offered' } : s)),
    phase: { kind: 'searching', round, radiusKm, offeredIds: ids, secondsLeft: ROUND_SECONDS },
  };
}

function startDrive(state: SimState, target: GeoPoint, serverId: string): SimState {
  const server = state.servers.find((s) => s.id === serverId)!;
  return {
    ...state,
    t: 0,
    servers: state.servers.map((s) => (s.id === serverId ? { ...s, state: 'assigned' } : s.state === 'offered' ? { ...s, state: 'declined' } : s)),
    route: streetPath(server.position, target),
    phase: { kind: 'en_route', serverId, etaMin: DRIVE_MINUTES, progress: 0 },
  };
}

function initial(target: GeoPoint, seed: string, mode: DispatchMode, assignedName: string | null): SimState {
  const pool = makePool(target, seed);
  const base: SimState = { t: 0, servers: pool, phase: { kind: 'searching', round: 1, radiusKm: 5, offeredIds: [], secondsLeft: ROUND_SECONDS }, route: null };
  if (mode === 'search') return startRound(base, target, 1, 5);

  // A server already has the job: put them first in the pool.
  const name = assignedName ?? 'Rahel Okafor';
  const assigned: SimServer = {
    id: 'assigned',
    name,
    initials: initialsOf(name),
    position: mode === 'at_door' ? offset(target, 14, 120) : offset(target, 6200, 300),
    state: 'assigned',
    rating: 4.9,
    jobsDone: 212,
  };
  const servers = [assigned, ...pool.filter((s) => s.name !== name)];
  if (mode === 'at_door') return { t: 0, servers, phase: { kind: 'arrived', serverId: 'assigned' }, route: null };
  return startDrive({ ...base, servers }, target, 'assigned');
}

function tick(state: SimState, target: GeoPoint, r: () => number): SimState {
  // Idle drift so the map feels live.
  const drifted = state.servers.map((s) =>
    s.state === 'assigned' ? s : { ...s, position: offset(s.position, 8 + r() * 18, r() * 360) },
  );
  let next: SimState = { ...state, servers: drifted, t: state.t + 1 };
  const ph = next.phase;

  if (ph.kind === 'searching') {
    const left = ROUND_SECONDS - next.t;
    // Round 3 (after widening): the far server accepts after 4 seconds.
    if (ph.round === 3 && next.t === 4 && ph.offeredIds[0]) return startDrive(next, target, ph.offeredIds[0]);
    if (left > 0) return { ...next, phase: { ...ph, secondsLeft: left } };
    // Offers timed out: those servers declined.
    next = { ...next, servers: next.servers.map((s) => (ph.offeredIds.includes(s.id) ? { ...s, state: 'declined' } : s)) };
    if (ph.round === 1) return startRound(next, target, 2, 10);
    const offered = next.servers.filter((s) => s.state === 'declined').length;
    const busy = next.servers.filter((s) => s.state === 'busy').length;
    return { ...next, t: 0, phase: { kind: 'none_available', radiusKm: ph.radiusKm, offered, busy, waiting: false } };
  }

  if (ph.kind === 'en_route' && next.route) {
    const progress = Math.min(1, next.t / DRIVE_SECONDS);
    const pos = along(next.route, progress);
    next = { ...next, servers: next.servers.map((s) => (s.id === ph.serverId ? { ...s, position: pos } : s)) };
    if (progress >= 1) return { ...next, route: null, phase: { kind: 'arrived', serverId: ph.serverId } };
    return { ...next, phase: { ...ph, progress, etaMin: Math.max(1, Math.ceil((1 - progress) * DRIVE_MINUTES)) } };
  }

  return next;
}

export function useDispatch(target: GeoPoint, seed: string, mode: DispatchMode, assignedName: string | null) {
  const [state, setState] = useState<SimState>(() => initial(target, seed, mode, assignedName));
  const rand = useRef(seededRandom(`${seed}:drift`));

  useEffect(() => {
    setState(initial(target, seed, mode, assignedName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, mode]);

  const settled = state.phase.kind === 'arrived';
  useEffect(() => {
    if (settled) return;
    const id = setInterval(() => setState((s) => tick(s, target, rand.current)), 1000);
    return () => clearInterval(id);
  }, [settled, target]);

  /** Client widens the search: a farther server gets the offer and accepts. */
  const widen = useCallback(() => {
    setState((s) => {
      if (s.phase.kind !== 'none_available') return s;
      const r = seededRandom(`${seed}:far`);
      const far: SimServer = {
        id: 'far',
        name: FAR_SERVER.name,
        initials: initialsOf(FAR_SERVER.name),
        position: offset(target, FAR_SERVER.km * 1000, FAR_SERVER.bearing),
        state: 'offered',
        rating: 4.9,
        jobsDone: 180 + Math.floor(r() * 100),
      };
      return {
        ...s,
        t: 0,
        servers: [...s.servers, far],
        phase: { kind: 'searching', round: 3, radiusKm: 25, offeredIds: ['far'], secondsLeft: ROUND_SECONDS },
      };
    });
  }, [seed, target]);

  const keepWaiting = useCallback(() => {
    setState((s) => (s.phase.kind === 'none_available' ? { ...s, phase: { ...s.phase, waiting: true } } : s));
  }, []);

  const remainingRoute = useMemo(
    () => (state.route && state.phase.kind === 'en_route' ? remaining(state.route, state.phase.progress) : null),
    [state.route, state.phase],
  );

  return { servers: state.servers, phase: state.phase, route: remainingRoute, widen, keepWaiting };
}
