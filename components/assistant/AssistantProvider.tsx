'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AssistantContext, AssistantReply, AssistantTurn } from '@/types/jobs';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reply?: AssistantReply;
  error?: boolean;
}

interface AssistantState {
  open: boolean;
  messages: ChatMessage[];
  pending: boolean;
  context: AssistantContext;
  openPanel: (question?: string) => void;
  closePanel: () => void;
  ask: (question: string) => Promise<void>;
  clear: () => void;
}

const Ctx = createContext<AssistantState | null>(null);
const DEFAULT_CONTEXT: AssistantContext = { page: 'other' };

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [context, setContext] = useState<AssistantContext>(DEFAULT_CONTEXT);
  const contextRef = useRef(context);
  contextRef.current = context;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    const history: AssistantTurn[] = messagesRef.current.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text })).slice(-8);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', text: q }]);
    setPending(true);
    try {
      const reply = await api.askAssistant({ question: q, history, context: contextRef.current });
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: reply.text, reply }]);
    } catch {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', text: 'I couldn’t reach ServeNow just now. Check your connection and ask again.', error: true }]);
    } finally {
      setPending(false);
    }
  }, []);

  const openPanel = useCallback(
    (question?: string) => {
      setOpen(true);
      if (question) void ask(question);
    },
    [ask],
  );

  const value = useMemo<AssistantState>(
    () => ({ open, messages, pending, context, openPanel, closePanel: () => setOpen(false), ask, clear: () => setMessages([]) }),
    [open, messages, pending, context, openPanel, ask],
  );

  return (
    <Ctx.Provider value={value}>
      <ContextSetter.Provider value={setContext}>{children}</ContextSetter.Provider>
    </Ctx.Provider>
  );
}

const ContextSetter = createContext<((c: AssistantContext) => void) | null>(null);

export function useAssistant(): AssistantState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAssistant must be used inside <AssistantProvider>');
  return v;
}

/** Pages call this so answers know what the user is looking at. */
export function useAssistantContext(context: AssistantContext): void {
  const set = useContext(ContextSetter);
  const key = JSON.stringify(context);
  useEffect(() => {
    set?.(JSON.parse(key) as AssistantContext);
  }, [set, key]);
}
