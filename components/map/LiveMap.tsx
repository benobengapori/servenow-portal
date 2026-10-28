'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@/types/jobs';

/*
 * Live map: OpenStreetMap data with CARTO basemap tiles (free, attribution required).
 * For production volume switch to a paid provider (Google Maps per Blueprint §2.1, or MapTiler);
 * only TILE_URL and ATTRIBUTION change.
 *
 * Everything is keyed by id so moving markers glide (setLatLng) instead of being redrawn.
 */

const TILE_URL = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export type MarkerKind =
  | 'target' // the service address
  | 'target-searching' // address with a radar pulse while dispatching
  | 'server-available'
  | 'server-busy'
  | 'server-offered'
  | 'server-declined'
  | 'server-assigned' // the server doing this job
  | 'attempt' // GPS point of an unsuccessful attempt
  | 'attempt-served' // GPS point where service happened
  | 'attempt-flagged'; // GPS point too far from the address

export interface MapMarker {
  id: string;
  position: GeoPoint;
  kind: MarkerKind;
  /** Short text inside the marker (initials, attempt number). */
  label?: string;
  /** Tooltip / screen-reader text. */
  title: string;
}

export interface MapCircle {
  id: string;
  center: GeoPoint;
  radiusM: number;
  kind: 'search' | 'privacy';
}

export interface MapLine {
  id: string;
  points: GeoPoint[];
  kind: 'route' | 'offer' | 'gps-offset';
}

interface Props {
  center: GeoPoint;
  zoom?: number;
  markers?: readonly MapMarker[];
  circles?: readonly MapCircle[];
  lines?: readonly MapLine[];
  /** When this key changes, the map fits these points. */
  fit?: { key: string; points: readonly GeoPoint[]; maxZoom?: number };
  className?: string;
  /** Read-only maps don't steal page scroll on phones. */
  interactive?: boolean;
  ariaLabel: string;
}

const ll = (p: GeoPoint): [number, number] => [p.lat, p.lng];

function prefersDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function iconFor(L: typeof Leaflet, m: MapMarker): Leaflet.DivIcon {
  const label = m.label ? `<span>${m.label.replace(/[<>&]/g, '')}</span>` : '';
  if (m.kind === 'target' || m.kind === 'target-searching') {
    return L.divIcon({
      className: '',
      html: `<div class="snm-target ${m.kind === 'target-searching' ? 'is-searching' : ''}"><i></i><i></i><b></b></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }
  if (m.kind.startsWith('server')) {
    return L.divIcon({
      className: '',
      html: `<div class="snm-server ${m.kind}">${label}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  }
  return L.divIcon({
    className: '',
    html: `<div class="snm-attempt ${m.kind}">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const CIRCLE_STYLE: Record<MapCircle['kind'], Leaflet.CircleMarkerOptions> = {
  search: { color: '#2f6fc4', weight: 1.5, dashArray: '5 5', fillColor: '#2f6fc4', fillOpacity: 0.06 },
  privacy: { color: '#2f6fc4', weight: 1, dashArray: '3 4', fillColor: '#2f6fc4', fillOpacity: 0.08 },
};
const LINE_STYLE: Record<MapLine['kind'], Leaflet.PolylineOptions> = {
  route: { color: '#1f4f8f', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' },
  offer: { color: '#2f6fc4', weight: 2, opacity: 0.7, dashArray: '2 6', lineCap: 'round' },
  'gps-offset': { color: '#a1262b', weight: 2, opacity: 0.8, dashArray: '4 4' },
};

export function LiveMap({ center, zoom = 14, markers = [], circles = [], lines = [], fit, className = '', interactive = true, ariaLabel }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markerLayers = useRef(new Map<string, { marker: Leaflet.Marker; kind: MarkerKind; label?: string }>());
  const circleLayers = useRef(new Map<string, Leaflet.Circle>());
  const lineGroup = useRef<Leaflet.LayerGroup | null>(null);
  const lastFit = useRef<string | null>(null);

  // Load Leaflet in the browser only (it touches window at import time).
  useEffect(() => {
    let alive = true;
    void import('leaflet').then((mod) => alive && setL(mod.default ?? mod));
    return () => {
      alive = false;
    };
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!L || !el.current || map.current) return;
    const m = L.map(el.current, {
      center: ll(center),
      zoom,
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: false,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      keyboard: interactive,
    });
    const tiles = L.tileLayer(prefersDark() ? TILE_URL.dark : TILE_URL.light, {
      attribution: ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
      detectRetina: true,
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    lineGroup.current = L.layerGroup().addTo(m);
    map.current = m;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => tiles.setUrl(prefersDark() ? TILE_URL.dark : TILE_URL.light);
    media.addEventListener('change', onTheme);
    // Containers that change size (phone rotation, panels) need Leaflet to re-measure.
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);

    const markersMap = markerLayers.current;
    const circlesMap = circleLayers.current;
    return () => {
      media.removeEventListener('change', onTheme);
      ro.disconnect();
      m.remove();
      map.current = null;
      markersMap.clear();
      circlesMap.clear();
      lastFit.current = null;
    };
    // center/zoom are initial values; later moves go through `fit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, interactive]);

  // Markers: add, move, restyle, remove by id.
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const seen = new Set<string>();
    for (const mk of markers) {
      seen.add(mk.id);
      const existing = markerLayers.current.get(mk.id);
      if (existing) {
        existing.marker.setLatLng(ll(mk.position));
        if (existing.kind !== mk.kind || existing.label !== mk.label) {
          existing.marker.setIcon(iconFor(L, mk));
          existing.kind = mk.kind;
          existing.label = mk.label;
        }
        existing.marker.setTooltipContent(mk.title);
      } else {
        const marker = L.marker(ll(mk.position), {
          icon: iconFor(L, mk),
          title: mk.title,
          alt: mk.title,
          keyboard: false,
          zIndexOffset: mk.kind.startsWith('target') ? 1000 : mk.kind === 'server-assigned' ? 900 : 0,
        })
          .bindTooltip(mk.title, { direction: 'top', offset: [0, -14] })
          .addTo(m);
        markerLayers.current.set(mk.id, { marker, kind: mk.kind, label: mk.label });
      }
    }
    for (const [id, layer] of markerLayers.current) {
      if (!seen.has(id)) {
        layer.marker.remove();
        markerLayers.current.delete(id);
      }
    }
  }, [L, markers]);

  // Circles.
  useEffect(() => {
    const m = map.current;
    if (!L || !m) return;
    const seen = new Set<string>();
    for (const c of circles) {
      seen.add(c.id);
      const existing = circleLayers.current.get(c.id);
      if (existing) {
        existing.setLatLng(ll(c.center));
        existing.setRadius(c.radiusM);
      } else {
        circleLayers.current.set(c.id, L.circle(ll(c.center), { radius: c.radiusM, interactive: false, ...CIRCLE_STYLE[c.kind] }).addTo(m));
      }
    }
    for (const [id, layer] of circleLayers.current) {
      if (!seen.has(id)) {
        layer.remove();
        circleLayers.current.delete(id);
      }
    }
  }, [L, circles]);

  // Lines are cheap; redraw.
  useEffect(() => {
    const g = lineGroup.current;
    if (!L || !g) return;
    g.clearLayers();
    for (const line of lines) {
      if (line.points.length > 1) L.polyline(line.points.map(ll), { interactive: false, ...LINE_STYLE[line.kind] }).addTo(g);
    }
  }, [L, lines]);

  // Fit when the caller asks.
  useEffect(() => {
    const m = map.current;
    if (!L || !m || !fit || fit.key === lastFit.current) return;
    lastFit.current = fit.key;
    // Measure first: on first paint the container may not have its final size yet,
    // and fitting against a stale size pushes edge points out of view.
    const raf = requestAnimationFrame(() => {
      m.invalidateSize({ animate: false });
      if (fit.points.length === 1) {
        m.setView(ll(fit.points[0]!), fit.maxZoom ?? zoom, { animate: true });
      } else if (fit.points.length > 1) {
        m.fitBounds(L.latLngBounds(fit.points.map(ll)), { padding: [48, 48], maxZoom: fit.maxZoom ?? 15, animate: true });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [L, fit, zoom]);

  return (
    <div className={`relative isolate overflow-hidden rounded-md border border-line bg-sunk ${className}`}>
      <div ref={el} className="absolute inset-0" role="region" aria-label={ariaLabel} />
      {!L ? <div className="absolute inset-0 grid place-items-center text-[12px] text-faint">Loading map…</div> : null}
    </div>
  );
}
