'use client';

import type { AddressValidation } from '@/types/jobs';

type Located = Extract<AddressValidation, { ok: true }>;

/**
 * Schematic map preview: the pin plus the ~1 km area servers see before accepting.
 * Swap for a Google Static Maps image (signed URL from the API) when available.
 */
export function MapPreview({ result }: { result: Located }) {
  const W = 320;
  const H = 150;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-full rounded-md border border-line" role="img" aria-label={`Map preview: ${result.formatted}`}>
      <rect width={W} height={H} fill="var(--sn-map-land)" />
      <path d="M0 118 C60 104 110 128 170 112 S 270 96 320 108 L320 150 L0 150Z" fill="var(--sn-map-water)" />
      {[30, 78, 126].map((y) => (
        <line key={`h${y}`} x1="0" x2={W} y1={y} y2={y + 6} stroke="var(--sn-map-road)" strokeWidth="5" />
      ))}
      {[54, 132, 214, 286].map((x) => (
        <line key={`v${x}`} x1={x} x2={x - 10} y1="0" y2={H} stroke="var(--sn-map-road)" strokeWidth="4" />
      ))}
      <circle cx="160" cy="68" r="46" fill="var(--sn-accent)" fillOpacity="0.1" stroke="var(--sn-accent)" strokeDasharray="4 3" strokeOpacity="0.6" />
      <path d="M160 70 c0 0 -11 -11 -11 -19 a11 11 0 0 1 22 0 c0 8 -11 19 -11 19z" fill="var(--sn-accent)" />
      <circle cx="160" cy="51" r="4" fill="var(--sn-surface)" />
      <text x="8" y={H - 8} fontSize="10" fill="var(--sn-muted)" fontFamily="var(--font-mono)">
        {result.location.lat.toFixed(4)}, {result.location.lng.toFixed(4)}
      </text>
      <text x={W - 8} y={H - 8} fontSize="10" fill="var(--sn-muted)" textAnchor="end">
        dashed = ~1 km shown to servers
      </text>
    </svg>
  );
}
