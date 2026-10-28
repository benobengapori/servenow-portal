import { Sidebar } from '@/components/Sidebar';

/** Authenticated portal shell. Add the auth guard here once a provider is chosen. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
