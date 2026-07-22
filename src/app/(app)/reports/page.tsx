'use client';

import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Download,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useBankStore } from '@/store/use-bank-store';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  useAccountTypeBreakdown,
  useDashboardStats,
  useMonthlySeries,
  useRequestStatusBreakdown,
  useBalanceByType,
  useTopAccounts,
} from '@/hooks/use-bank-data';
import { toast } from '@/store/use-toast-store';
import { countBy, groupBy, sumBy } from '@/lib/algorithms/structures';
import { exportCsv, exportPdf } from '@/lib/utils/export';
import { formatCurrency, formatNumber, fullName, titleCase } from '@/lib/utils/format';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import { DonutChart } from '@/components/charts/distribution-chart';
import { CategoryBarChart } from '@/components/charts/bar-chart';

export default function ReportsPage() {
  const hydrated = useHydrated();

  const customers = useBankStore((s) => s.customers);
  const accounts = useBankStore((s) => s.accounts);
  const transactions = useBankStore((s) => s.transactions);
  const settings = useBankStore((s) => s.settings);

  const stats = useDashboardStats();
  const monthly = useMonthlySeries(12);
  const accountTypes = useAccountTypeBreakdown();
  const balanceByType = useBalanceByType();
  const requestStatuses = useRequestStatusBreakdown();
  const topAccounts = useTopAccounts(8);

  const currency = settings.baseCurrency;

  /** Customers grouped by country, largest first — a geography breakdown. */
  const byCountry = useMemo(() => {
    const counts = countBy(customers, (c) => c.country);
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customers]);

  /** Transaction volume by type, in major units. */
  const volumeByType = useMemo(() => {
    const settled = transactions.filter((t) => t.status === 'completed');
    const groups = groupBy(settled, (t) => t.type);
    return [...groups.entries()].map(([name, group]) => ({
      name,
      value: Math.round(sumBy(group, (t) => t.amount) / 100),
    }));
  }, [transactions]);

  const kycBreakdown = useMemo(() => {
    const counts = countBy(customers, (c) => c.kycStatus);
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [customers]);

  /**
   * Revenue proxy: fee income plus a notional 1.5% net interest margin on
   * deposit balances. Clearly a demo estimate, labelled as such in the UI.
   */
  const revenue = useMemo(() => {
    const fees = sumBy(
      transactions.filter((t) => t.type === 'fee' && t.status === 'completed'),
      (t) => t.amount,
    );
    const deposits = sumBy(
      accounts.filter((a) => a.status !== 'closed'),
      (a) => Math.max(0, a.balance),
    );
    return { fees, margin: Math.round(deposits * 0.015), total: fees + Math.round(deposits * 0.015) };
  }, [transactions, accounts]);

  const handleExportSummary = () => {
    const rows = [
      { metric: 'Total customers', value: formatNumber(stats.totalCustomers) },
      { metric: 'Active customers', value: formatNumber(stats.activeCustomers) },
      { metric: 'Total accounts', value: formatNumber(stats.totalAccounts) },
      { metric: 'Active accounts', value: formatNumber(stats.activeAccounts) },
      { metric: 'Total balance', value: formatCurrency(stats.totalBalance, currency) },
      { metric: 'Inflow (30d)', value: formatCurrency(stats.monthlyInflow, currency) },
      { metric: 'Outflow (30d)', value: formatCurrency(stats.monthlyOutflow, currency) },
      { metric: 'Transactions (30d)', value: formatNumber(stats.recentTransactions) },
      { metric: 'Pending transactions', value: formatNumber(stats.pendingTransactions) },
      { metric: 'Pending requests', value: formatNumber(stats.pendingRequests) },
      { metric: 'Staff', value: formatNumber(stats.staffCount) },
      { metric: 'Estimated fee income', value: formatCurrency(revenue.fees, currency) },
      { metric: 'Estimated interest margin', value: formatCurrency(revenue.margin, currency) },
    ];

    exportCsv('bank-summary-report', rows, [
      { header: 'Metric', value: (r) => r.metric },
      { header: 'Value', value: (r) => r.value },
    ]);
    toast.success('Report exported', 'The summary report was downloaded as CSV.');
  };

  const handleExportPdf = () => {
    const rows = monthly.map((point) => ({
      ...point,
      netLabel: point.net >= 0 ? `+${formatNumber(point.net)}` : formatNumber(point.net),
    }));

    const opened = exportPdf(
      'Monthly performance report',
      rows,
      [
        { header: 'Month', value: (r) => r.month },
        { header: 'Deposits', value: (r) => formatNumber(r.deposits) },
        { header: 'Withdrawals', value: (r) => formatNumber(r.withdrawals) },
        { header: 'Transfers', value: (r) => formatNumber(r.transfers) },
        { header: 'Net flow', value: (r) => r.netLabel },
      ],
      `Base currency ${currency} · 12-month view`,
    );

    if (opened) {
      toast.info('Print view opened', 'Choose “Save as PDF” in the print dialog.');
    } else {
      toast.error('Popup blocked', 'Allow popups for this site to export a PDF report.');
    }
  };

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports &amp; analytics"
        description="Portfolio performance, customer statistics and transaction summaries."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="h-4 w-4" aria-hidden />}
              onClick={handleExportSummary}
            >
              Summary CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              Performance PDF
            </Button>
          </>
        }
      />

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assets under management"
          value={formatCurrency(stats.totalBalance, currency, { compact: true })}
          icon={<Banknote className="h-4.5 w-4.5" aria-hidden />}
          tone="brand"
          hint={`${formatNumber(stats.activeAccounts)} active accounts`}
        />
        <StatCard
          label="Estimated revenue"
          value={formatCurrency(revenue.total, currency, { compact: true })}
          icon={<TrendingUp className="h-4.5 w-4.5" aria-hidden />}
          tone="teal"
          hint="Fees + 1.5% notional margin"
        />
        <StatCard
          label="Inflow (30d)"
          value={formatCurrency(stats.monthlyInflow, currency, { compact: true })}
          icon={<ArrowDownLeft className="h-4.5 w-4.5" aria-hidden />}
          tone="purple"
        />
        <StatCard
          label="Outflow (30d)"
          value={formatCurrency(stats.monthlyOutflow, currency, { compact: true })}
          icon={<ArrowUpRight className="h-4.5 w-4.5" aria-hidden />}
          tone="amber"
        />
      </div>

      {/* Cashflow */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Twelve-month money movement</CardTitle>
            <p className="mt-0.5 text-xs text-muted-text">
              Settled transaction volume by type, in {currency}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <CashflowChart data={monthly} height={320} />
        </CardContent>
      </Card>

      {/* Distributions */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Balance by account type</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Where deposits are held</p>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={balanceByType}
              centerLabel="Total"
              formatValue={(v) => formatCurrency(v * 100, currency, { compact: true })}
              height={220}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Accounts by type</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Count of open accounts</p>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart data={accountTypes} centerLabel="Accounts" height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Transaction volume by type</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Settled value, in {currency}</p>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={volumeByType}
              layout="horizontal"
              height={220}
              formatValue={(v) => formatCurrency(v * 100, currency, { compact: true })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Customers by country</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Top six markets</p>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={byCountry}
              layout="horizontal"
              height={220}
              formatValue={(v) => formatNumber(v)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Request pipeline</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Service requests by status</p>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={requestStatuses}
              centerLabel="Requests"
              height={220}
              useStatusColors
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>KYC compliance</CardTitle>
              <p className="mt-0.5 text-xs text-muted-text">Verification status across customers</p>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={kycBreakdown}
              centerLabel="Customers"
              height={220}
              useStatusColors
            />
          </CardContent>
        </Card>
      </div>

      {/* Top accounts table — the table view that discharges the contrast WARN. */}
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Highest-value accounts</CardTitle>
            <p className="mt-0.5 text-xs text-muted-text">Top eight by current balance</p>
          </div>
          <Users className="h-4 w-4 text-muted-text" aria-hidden />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-sunken">
                  <th className="px-5 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase">
                    Customer
                  </th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase sm:table-cell">
                    Type
                  </th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold tracking-wide text-secondary-text uppercase md:table-cell">
                    Currency
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold tracking-wide text-secondary-text uppercase">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map(({ account, customer }) => (
                  <tr
                    key={account.id}
                    className="border-b border-border-subtle last:border-0 transition-colors hover:bg-surface-hover"
                  >
                    <td className="px-5 py-3 text-sm text-primary-text">
                      {customer ? fullName(customer) : 'Unknown'}
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-secondary-text sm:table-cell">
                      {titleCase(account.type)}
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-secondary-text tabular md:table-cell">
                      {account.currency}
                    </td>
                    <td className="px-5 py-3 text-right text-sm font-semibold text-primary-text tabular">
                      {formatCurrency(account.balance, account.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-[11px] text-muted-text">
        Figures are derived from locally stored demo data. Revenue is an illustrative estimate,
        not an accounting figure.
      </p>
    </div>
  );
}
