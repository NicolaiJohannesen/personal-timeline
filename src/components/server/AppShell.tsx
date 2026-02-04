import { Sidebar } from '@/components/client/Sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-64 transition-all duration-300">
        <div className="min-h-screen p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
