import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  PieChart,
  Settings,
  Users,
  UserCog,
} from 'lucide-react';
import type { Permission } from '@/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Item is hidden unless the signed-in role holds this permission. */
  permission: Permission;
  /** Optional grouping heading rendered above the item. */
  section: 'Overview' | 'Banking' | 'Operations' | 'Administration';
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: 'customer:read',
    section: 'Overview',
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
    permission: 'customer:read',
    section: 'Banking',
  },
  {
    label: 'Accounts',
    href: '/accounts',
    icon: CreditCard,
    permission: 'account:read',
    section: 'Banking',
  },
  {
    label: 'Transactions',
    href: '/transactions',
    icon: ArrowLeftRight,
    permission: 'transaction:read',
    section: 'Banking',
  },
  {
    label: 'Requests',
    href: '/requests',
    icon: ClipboardList,
    permission: 'request:read',
    section: 'Operations',
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: PieChart,
    permission: 'report:read',
    section: 'Operations',
  },
  {
    label: 'Staff',
    href: '/staff',
    icon: UserCog,
    permission: 'staff:read',
    section: 'Administration',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    permission: 'customer:read',
    section: 'Administration',
  },
];

export const NAV_SECTIONS: Array<NavItem['section']> = [
  'Overview',
  'Banking',
  'Operations',
  'Administration',
];

/**
 * Whether `pathname` should light up `href` in the sidebar.
 * Matches nested routes (`/customers/cus_1` activates `/customers`) without
 * letting `/accounts` match `/accounts-archive`.
 */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
