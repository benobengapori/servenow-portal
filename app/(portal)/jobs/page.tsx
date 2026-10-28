import type { Metadata } from 'next';
import { JobsDashboard } from './_components/JobsDashboard';

export const metadata: Metadata = { title: 'Active jobs' };

/** Active jobs. Client-rendered so it works as a static export against the demo API. */
export default function JobsPage() {
  return <JobsDashboard />;
}
