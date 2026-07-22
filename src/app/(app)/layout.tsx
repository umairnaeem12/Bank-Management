import { AppShell } from '@/components/layout/app-shell';

/**
 * Wraps every authenticated route. The `(app)` route group keeps the login
 * page out of this layout so it renders without the sidebar and header.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
