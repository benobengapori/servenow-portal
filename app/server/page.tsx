import type { Metadata } from 'next';
import { ServerHome } from './_components/ServerHome';

export const metadata: Metadata = { title: 'Jobs near me' };

export default function ServerPage() {
  return <ServerHome />;
}
