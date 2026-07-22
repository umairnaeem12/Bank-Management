import { redirect } from 'next/navigation';

/**
 * The root path has no content of its own. Sending users to /dashboard lets
 * the authenticated layout's guard decide whether they land there or get
 * bounced to /login.
 */
export default function RootPage() {
  redirect('/dashboard');
}
