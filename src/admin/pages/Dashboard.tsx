import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { ClipboardList, Clock, CheckCircle, Zap } from 'lucide-react';

interface PriorityDetail {
  total: number;
  pending: number;
  resolved: number;
}

interface ReporterStat {
  email: string | null;
  name: string | null;
  total: number;
  pending: number;
  resolved: number;
}

interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byPriorityDetail?: Record<string, PriorityDetail>;
  byReporter?: ReporterStat[];
}

const PRIORITY_ORDER = ['highest', 'high', 'medium', 'low', 'lowest'] as const;

export function Dashboard() {
  const { t } = useTranslation();
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/reports/stats/overview');
      return response.data.stats as DashboardStats;
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const { data: recentReports, isLoading: reportsLoading } = useQuery({
    queryKey: ['recent-reports'],
    queryFn: async () => {
      const response = await api.get('/reports', { params: { limit: 5 } });
      return response.data.data;
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  const stats: DashboardStats = statsData || {
    total: 0,
    byStatus: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    byPriority: { lowest: 0, low: 0, medium: 0, high: 0, highest: 0 },
    byPriorityDetail: undefined,
    byReporter: [],
  };

  const openReports = (stats.byStatus.open || 0) + (stats.byStatus.in_progress || 0);
  const resolvedReports = (stats.byStatus.resolved || 0) + (stats.byStatus.closed || 0);
  const reporters = stats.byReporter ?? [];
  const priorityDetail = stats.byPriorityDetail;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.overview')}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.totalReports')}
          value={stats.total}
          icon={<ClipboardList className="h-5 w-5" />}
          variant="default"
        />
        <StatCard
          title={t('dashboard.open')}
          value={openReports}
          icon={<Clock className="h-5 w-5" />}
          variant="blue"
        />
        <StatCard
          title={t('dashboard.inProgress')}
          value={stats.byStatus.in_progress || 0}
          icon={<Zap className="h-5 w-5" />}
          variant="yellow"
        />
        <StatCard
          title={t('dashboard.resolved')}
          value={resolvedReports}
          icon={<CheckCircle className="h-5 w-5" />}
          variant="green"
        />
      </div>

      {/* 多维度统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="border-b py-4">
            <CardTitle className="text-lg font-medium">
              {t('dashboard.byPriorityTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.priority')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.pending')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.resolved')}</TableHead>
                  <TableHead className="text-right">{t('dashboard.totalReports')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRIORITY_ORDER.map((p) => {
                  const detail = priorityDetail?.[p] ?? {
                    total: stats.byPriority[p] || 0,
                    pending: 0,
                    resolved: 0,
                  };
                  return (
                    <TableRow key={p}>
                      <TableCell>
                        <PriorityBadge priority={p} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{detail.pending}</TableCell>
                      <TableCell className="text-right tabular-nums">{detail.resolved}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {detail.total}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b py-4">
            <CardTitle className="text-lg font-medium">
              {t('dashboard.byReporterTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {reporters.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                {t('dashboard.noReporterData')}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.reporter')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.pending')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.resolved')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.totalReports')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporters.map((r, idx) => (
                    <TableRow key={`${r.email ?? 'anon'}-${idx}`}>
                      <TableCell className="max-w-[18rem]">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.name || r.email || t('dashboard.anonymous')}
                          </p>
                          {r.email && r.name && (
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.pending}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.resolved}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent reports */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <CardTitle className="text-lg font-medium">{t('dashboard.recentReports')}</CardTitle>
          <Link to="/reports" className="text-sm text-primary hover:underline">
            {t('dashboard.viewAll')}
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {reportsLoading ? (
              <div className="p-6 text-center text-muted-foreground">{t('common.loading')}</div>
            ) : recentReports?.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">{t('dashboard.noReports')}</div>
            ) : (
              recentReports?.map((report: ReportItem) => (
                <Link
                  key={report.id}
                  to={`/reports/${report.id}`}
                  className="block px-6 py-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{report.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {report.metadata?.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-4 sm:shrink-0">
                      <StatusBadge status={report.status} />
                      <PriorityBadge priority={report.priority} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ReportItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  metadata?: { url?: string };
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  variant,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  variant: 'default' | 'blue' | 'green' | 'yellow';
}) {
  const iconClasses = {
    default: 'bg-primary/10 text-primary',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${iconClasses[variant]}`}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    open: t('dashboard.open'),
    in_progress: t('dashboard.inProgress'),
    developed: t('dashboard.developed'),
    resolved: t('dashboard.resolved'),
    closed: t('dashboard.closed'),
  };

  return (
    <Badge variant="outline" className={`status-${status}`}>
      {labels[status] || status}
    </Badge>
  );
}

// Priority Badge Component
function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={`priority-${priority} uppercase text-xs`}>
      {priority}
    </Badge>
  );
}
