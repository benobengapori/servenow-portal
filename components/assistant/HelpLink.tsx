'use client';

import { Icon } from '@/app/(portal)/jobs/new/_components/ui';
import { useAssistant } from './AssistantProvider';

/** A small "?" link that opens Ask ServeNow with a question already asked. */
export function HelpLink({ question, label }: { question: string; label: string }) {
  const { openPanel } = useAssistant();
  return (
    <button type="button" onClick={() => openPanel(question)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
      <Icon name="sparkle" className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
