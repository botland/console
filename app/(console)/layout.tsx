import { Shell } from '@/components/Shell';
import { StatusProvider } from '@/lib/status-context';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <StatusProvider>
      <Shell>{children}</Shell>
    </StatusProvider>
  );
}