import type { Metadata } from 'next';
import { Suspense } from 'react';
import { JobView } from './_components/JobView';

export const metadata: Metadata = { title: 'Job' };

/**
 * /jobs/view/?id=… — tracking map, attempts and affidavit for one job.
 * A query parameter rather than /jobs/[id] so it works as a static export (ids aren't known at build).
 */
export default function JobPage() {
  return (
    <Suspense fallback={null}>
      <JobView />
    </Suspense>
  );
}
