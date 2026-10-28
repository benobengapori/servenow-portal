import type { Metadata } from 'next';
import { IntakeWizard } from './_components/IntakeWizard';

export const metadata: Metadata = { title: 'Submit new job' };

/**
 * Job intake: matter → documents → person & address → quote & payment.
 * Server component shell; the interactive wizard is a client component.
 */
export default function NewJobPage() {
  return <IntakeWizard />;
}
