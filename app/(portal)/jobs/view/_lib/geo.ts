import type { GeoPoint } from '@/types/jobs';

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Point `meters` away from `p` at compass bearing `deg`. */
export function offset(p: GeoPoint, meters: number, deg: number): GeoPoint {
  const d = meters / R;
  const b = rad(deg);
  const lat1 = rad(p.lat);
  const lng1 = rad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point at fraction `t` (0–1) along a polyline, by distance. */
export function along(points: readonly GeoPoint[], t: number): GeoPoint {
  if (points.length === 0) throw new Error('empty polyline');
  if (points.length === 1 || t <= 0) return points[0]!;
  const segs = points.slice(1).map((p, i) => distanceM(points[i]!, p));
  const total = segs.reduce((a, b) => a + b, 0);
  let left = Math.min(1, t) * total;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]!;
    if (left <= s || i === segs.length - 1) {
      const f = s === 0 ? 0 : Math.min(1, left / s);
      const a = points[i]!;
      const b = points[i + 1]!;
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    left -= s;
  }
  return points[points.length - 1]!;
}

/** The part of a polyline still ahead after fraction `t`. */
export function remaining(points: readonly GeoPoint[], t: number): GeoPoint[] {
  if (points.length < 2) return [...points];
  const here = along(points, t);
  const segs = points.slice(1).map((p, i) => distanceM(points[i]!, p));
  const total = segs.reduce((a, b) => a + b, 0);
  let acc = 0;
  let idx = 0;
  for (; idx < segs.length; idx++) {
    acc += segs[idx]!;
    if (acc >= t * total) break;
  }
  return [here, ...points.slice(idx + 1)];
}

/** A street-like path: east-west then north-south legs with a jog, instead of a straight line. */
export function streetPath(from: GeoPoint, to: GeoPoint): GeoPoint[] {
  const midLat = from.lat + (to.lat - from.lat) * 0.55;
  return [from, { lat: midLat, lng: from.lng }, { lat: midLat, lng: to.lng + (from.lng - to.lng) * 0.12 }, { lat: to.lat, lng: to.lng + (from.lng - to.lng) * 0.12 }, to];
}

/** Small deterministic PRNG so the same job always gets the same simulated servers. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (const ch of seed) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
