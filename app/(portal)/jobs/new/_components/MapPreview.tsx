'use client';

import { LiveMap } from '@/components/map/LiveMap';
import type { AddressValidation } from '@/types/jobs';

type Located = Extract<AddressValidation, { ok: true }>;

/** Real map of the validated address, with the ~1 km area servers see before they accept. */
export function MapPreview({ result }: { result: Located }) {
  const key = `${result.location.lat},${result.location.lng}`;
  return (
    <div className="flex flex-col gap-1">
      <LiveMap
        className="h-48 w-full"
        center={result.location}
        zoom={14}
        interactive={false}
        ariaLabel={`Map of ${result.formatted}`}
        markers={[{ id: 'target', position: result.location, kind: 'target', title: result.formatted }]}
        circles={[{ id: 'privacy', center: result.location, radiusM: 1000, kind: 'privacy' }]}
        fit={{ key, points: [result.location], maxZoom: 14 }}
      />
      <div className="flex justify-between gap-2 font-mono text-[10.5px] text-faint">
        <span>
          {result.location.lat.toFixed(4)}, {result.location.lng.toFixed(4)}
        </span>
        <span className="font-sans">Dashed circle: the area servers see before they accept</span>
      </div>
    </div>
  );
}
