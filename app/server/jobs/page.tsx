import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ServerJob } from './_components/ServerJob';

export const metadata: Metadata = { title: 'Job' };

export default function ServerJobPage() {
  return (
    <Suspense fallback={null}>
      <ServerJob />
    </Suspense>
  );
}
