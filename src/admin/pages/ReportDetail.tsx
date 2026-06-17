import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useIntegrations, useForwardReport } from '../hooks/useIntegrations';
import { useReporterMessages } from '../hooks/useReporterMessages';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  ChevronLeft,
  ChevronDown,
  ExternalLink,
  Send,
  X,
  ZoomIn,
  AlertCircle,
  RefreshCw,
  Github,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Spinner } from '../components/ui/spinner';
import { formatDate, formatDateTime } from '../lib/utils';
import { AIAnalysisCard } from '../components/AIAnalysisCard';
import type { AppSettings, Project, Report, ReportSource, User } from '@shared/types';

const UNASSIGNED_VALUE = '__unassigned__';

export function ReportDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 返回列表时优先用进入详情时记下的 URL（含 ?status=...&page=... 等筛选），
  // 直链访问没有 state 时回退到 /reports 根
  const backToList = () => {
    const fromList = (location.state as { fromList?: string } | null)?.fromList;
    navigate(fromList || '/reports');
  };
  const isAdmin = user?.role === 'admin';
  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  // lula 2026-06-03: 删除 isEditing / editData / showResolveMessage —— inline 编辑后不再需要
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [composeMessage, setComposeMessage] = useState('');
  const [composeCcSender, setComposeCcSender] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      const response = await api.get(`/reports/${id}`);
      return response.data;
    },
    enabled: !!id,
    // lula 2026-06-05 v1.0.31: 当 AI 正在分析时每 3 秒轮询一次，看 status 变化
    // 后端 trigger 改为 fire-and-forget 后，前端靠轮询知道分析何时完成
    refetchInterval: (query) => {
      const aiStatus = (query.state.data as { report?: { aiAnalysis?: { status?: string } } })
        ?.report?.aiAnalysis?.status;
      return aiStatus === 'analyzing' ? 3000 : false;
    },
  });

  // Load integrations for this report's project
  const { data: integrations } = useIntegrations(data?.report?.projectId);

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: async () => {
      const response = await api.get('/users/assignable');
      return response.data.users as User[];
    },
    enabled: canEdit,
  });

  // Fetch global settings for messaging enabled check
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.settings as AppSettings;
    },
    enabled: !!data?.report?.projectId,
  });

  // Fetch project for per-project messaging settings
  const { data: projectData } = useQuery({
    queryKey: ['project', data?.report?.projectId],
    queryFn: async () => {
      const response = await api.get(`/projects/${data?.report?.projectId}`);
      return response.data.project as Project;
    },
    enabled: !!data?.report?.projectId,
  });

  // Reporter messages
  const {
    messages: reporterMessages,
    isLoading: messagesLoading,
    sendMessage,
    isSending,
  } = useReporterMessages(id ?? '');

  const forwardMutation = useForwardReport();

  const retrySyncMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/reports/${id}/retry-sync`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      toast.success(t('reportDetail.syncRetryInitiated'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('reportDetail.failedRetrySync'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { status?: string; priority?: string; assignedTo?: string | null }) => {
      const response = await api.patch(`/reports/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['recent-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(t('reportDetail.reportUpdated'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('reportDetail.failedUpdate'));
    },
  });

  // lula 2026-06-03: 详情页 inline 编辑——状态/优先级/指派 select 切换后直接 PATCH
  const inlineUpdate = (field: 'status' | 'priority' | 'assignedTo', value: string) => {
    if (field === 'assignedTo') {
      updateMutation.mutate({ assignedTo: value === UNASSIGNED_VALUE ? null : value });
    } else {
      updateMutation.mutate({ [field]: value });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['recent-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(t('reportDetail.reportDeleted'));
      backToList();
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('reportDetail.failedDelete'));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (error || !data?.report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('reportDetail.reportNotFound')}</p>
        <Button variant="outline" onClick={backToList} className="mt-4">
          {t('reportDetail.backToReports')}
        </Button>
      </div>
    );
  }

  const { report, files } = data as {
    report: Report;
    files: Array<{ id: string; mimeType: string; filename: string }>;
  };
  const consoleErrors = report.metadata.consoleErrors ?? [];
  const networkErrors = report.metadata.networkErrors ?? [];
  const userActivity = report.metadata.userActivity ?? [];
  const appName = settingsData?.appName || 'BugPin';
  const manualChannel = report.metadata.manualContext?.channel;
  const hasPageInfo = Boolean(
    report.metadata?.url ||
      report.metadata?.title ||
      report.metadata?.referrer ||
      report.metadata?.pageLoadTime ||
      report.metadata?.timezone,
  );
  const hasEnvironment = Boolean(
    report.metadata?.browser?.name ||
      report.metadata?.browser?.version ||
      report.metadata?.device?.os ||
      report.metadata?.device?.osVersion ||
      report.metadata?.device?.type ||
      report.metadata?.viewport?.width ||
      report.metadata?.viewport?.height,
  );

  const messagingEnabled = (() => {
    if (projectData?.settings?.notifyReporter === false) return false;
    const effectiveEmailEnabled =
      projectData?.settings?.reporterNotifications?.emailEnabled ??
      settingsData?.reporterNotifications?.emailEnabled ??
      true;
    if (!effectiveEmailEnabled) return false;
    return (
      projectData?.settings?.reporterNotifications?.messagingEnabled ??
      settingsData?.reporterNotifications?.messagingEnabled ??
      true
    );
  })();

  // lula 2026-06-03: handleSave 删除——inline 编辑直接 PATCH，无需手动 save
  // resolved 状态的 reporter 通知改走「reporter messages」区独立发送，不再混在状态切换里

  const handleForward = async (integrationId: string, integrationName: string) => {
    if (!id) return;

    try {
      await forwardMutation.mutateAsync({
        reportId: id,
        integrationId,
      });
      toast.success(t('reportDetail.reportForwarded', { name: integrationName }));
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    } catch (error) {
      console.error('Failed to forward report:', error);
    }
  };

  const activeIntegrations = integrations?.filter((i) => i.isActive) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={backToList}
            className="mb-2 -ml-2 text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {t('reportDetail.backToReports')}
          </Button>
          <h1 className="text-2xl font-bold">{report.title}</h1>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {/* lula 2026-06-03: 状态/优先级/指派改为侧栏 inline 编辑，去掉「编辑」按钮 */}
            {isAdmin && activeIntegrations.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={forwardMutation.isPending}>
                    {forwardMutation.isPending ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Forwarding...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Forward
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {activeIntegrations.map((integration) => (
                    <DropdownMenuItem
                      key={integration.id}
                      onClick={() => handleForward(integration.id, integration.name)}
                    >
                      {integration.type === 'github' && 'GitHub: '}
                      {integration.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteMutation.isPending}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* lula 2026-06-17: 操作区置顶——状态/优先级/处理人横排，最显眼。
          原来埋在右侧栏，导致左短右长、操作不突出。「查看」类信息全部下沉到下方两栏。 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('common.status')}</Label>
              {canEdit ? (
                <Select
                  value={report.status}
                  onValueChange={(value) => inlineUpdate('status', value)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t('dashboard.open')}</SelectItem>
                    <SelectItem value="in_progress">{t('dashboard.inProgress')}</SelectItem>
                    <SelectItem value="developed">{t('dashboard.developed')}</SelectItem>
                    <SelectItem value="resolved">{t('dashboard.resolved')}</SelectItem>
                    <SelectItem value="closed">{t('dashboard.closed')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div>
                  <StatusBadge status={report.status} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('common.priority')}</Label>
              {canEdit ? (
                <Select
                  value={report.priority}
                  onValueChange={(value) => inlineUpdate('priority', value)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lowest">{t('reports.priorityLowest')}</SelectItem>
                    <SelectItem value="low">{t('reports.priorityLow')}</SelectItem>
                    <SelectItem value="medium">{t('reports.priorityMedium')}</SelectItem>
                    <SelectItem value="high">{t('reports.priorityHigh')}</SelectItem>
                    <SelectItem value="highest">{t('reports.priorityHighest')}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div>
                  <PriorityBadge priority={report.priority} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t('reports.assigneeLabel')}</Label>
              {canEdit ? (
                <Select
                  value={report.assignedTo ?? UNASSIGNED_VALUE}
                  onValueChange={(value) => inlineUpdate('assignedTo', value)}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.unassigned')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>{t('common.unassigned')}</SelectItem>
                    {assignableUsers.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.id === user?.id ? `${assignee.name}（${t('reports.you')}）` : assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <AssigneeDisplay user={report.assignee} showEmail />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* lula 2026-06-17: AI 分析从右侧栏移到主列顶部——内容量大、优先级最高，
              放主列既更突出，也让左右两栏高度平衡 */}
          {canEdit && id && (
            <AIAnalysisCard
              reportId={id}
              report={report}
              aiEnabled={settingsData?.aiEnabled ?? false}
            />
          )}
          {/* Screenshots/Media */}
          {files?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {files.length === 1 ? 'Screenshot' : `Screenshots (${files.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-4 ${files.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {files.map((file: { id: string; mimeType: string; filename: string }) => {
                    const fileUrl = `/api/reports/${id}/files/${file.id}`;
                    const isVideo = file.mimeType?.startsWith('video/');

                    return (
                      <div key={file.id} className="relative group">
                        {isVideo ? (
                          <video
                            src={fileUrl}
                            controls
                            className="w-full rounded-lg border bg-black"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setViewingImage(fileUrl)}
                            className="w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
                          >
                            <img
                              src={fileUrl}
                              alt={file.filename || 'Screenshot'}
                              className="w-full rounded-lg border object-contain bg-muted"
                              style={{ maxHeight: files.length > 1 ? '200px' : '400px' }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Image Lightbox */}
          {viewingImage && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setViewingImage(null)}
            >
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
              <img
                src={viewingImage}
                alt="Full size screenshot"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <a
                href={viewingImage}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 right-4 text-white hover:text-gray-300 transition-colors flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-5 h-5" />
                Open in new tab
              </a>
            </div>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>{t('reportDetail.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {report.description || t('common.noDescription')}
              </p>
            </CardContent>
          </Card>

          {/* lula 2026-06-17: 报告人消息从右侧栏移到主列——是阅读/沟通内容，放主列更合理，
              也顺手修了原来 t(...) 没被求值、直接显示字面量的 bug */}
          {report.reporterEmail && messagingEnabled && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('reportDetail.reporterMessages')}
                  {reporterMessages.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {reporterMessages.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Compose new message (admin/editor only) */}
                {canEdit && (
                  <>
                    <div className="space-y-2">
                      <Textarea
                        placeholder={t('reportDetail.writeMessage')}
                        value={composeMessage}
                        onChange={(e) => setComposeMessage(e.target.value)}
                        rows={3}
                        disabled={isSending}
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <Checkbox
                            checked={composeCcSender}
                            onCheckedChange={(checked) =>
                              setComposeCcSender(checked === true)
                            }
                            disabled={isSending}
                          />
                          {t('reportDetail.sendMeACopy')}
                        </label>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (composeMessage.trim()) {
                              sendMessage(
                                { message: composeMessage.trim(), ccSender: composeCcSender },
                                {
                                  onSuccess: () => {
                                    setComposeMessage('');
                                    setComposeCcSender(false);
                                  },
                                },
                              );
                            }
                          }}
                          disabled={!composeMessage.trim() || isSending}
                        >
                          {isSending ? (
                            <>
                              <Spinner size="sm" className="mr-2" />
                              {t('reportDetail.sending')}
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              {t('reportDetail.sendMessage')}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Message history */}
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" className="text-muted-foreground" />
                  </div>
                ) : reporterMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {t('reportDetail.noMessages')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reporterMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className="rounded-lg border bg-muted/30 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium">
                            {msg.userName ?? 'System'}
                          </span>
                          <span title={formatDateTime(msg.sentAt)}>
                            {formatRelativeTime(new Date(msg.sentAt))}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Console Output */}
          {consoleErrors.length > 0 && (
            <Collapsible>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle>
                      Console Output
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({consoleErrors.length})
                      </span>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                      {consoleErrors.map(
                        (
                          err: { type: string; message: string; source?: string; line?: number },
                          i: number,
                        ) => (
                          <div
                            key={i}
                            className={`px-4 py-2 rounded-lg text-sm font-mono ${
                              err.type === 'warn'
                                ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'
                            }`}
                          >
                            <span className="font-semibold uppercase text-xs mr-2">
                              [{err.type}]
                            </span>
                            {err.message}
                            {err.source && (
                              <span className="block text-xs opacity-70 mt-1">
                                {err.source}
                                {err.line && `:${err.line}`}
                              </span>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Network Errors */}
          {networkErrors.length > 0 && (
            <Collapsible>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle>
                      Network Errors
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({networkErrors.length})
                      </span>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-2">
                    {networkErrors.map(
                      (
                        err: { url: string; method: string; status: number; statusText: string },
                        i: number,
                      ) => (
                        <div
                          key={i}
                          className={`px-4 py-2 rounded-lg text-sm font-mono ${
                            err.status === 0 || err.status >= 500
                              ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'
                              : err.status >= 400
                                ? 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-200'
                                : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                          }`}
                        >
                          <span className="font-semibold">
                            {err.status === 0 ? 'Network Error' : err.status} {err.statusText}
                          </span>
                          <span className="mx-2 opacity-50">|</span>
                          <span className="uppercase text-xs">{err.method}</span>
                          <span className="block text-xs opacity-70 mt-1 break-all">{err.url}</span>
                        </div>
                      ),
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* User Activity Trail */}
          {userActivity.length > 0 && (
            <Collapsible>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle>
                      User Activity Trail
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({userActivity.length} events)
                      </span>
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                      {userActivity.map(
                        (
                          activity: {
                            type: string;
                            text?: string;
                            url?: string;
                            inputType?: string;
                            timestamp: string;
                          },
                          i: number,
                        ) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 px-3 py-2 rounded-lg bg-muted/50 text-sm"
                          >
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium uppercase ${
                                activity.type === 'button'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : activity.type === 'link'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : activity.type === 'input'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                      : activity.type === 'select'
                                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                        : activity.type === 'checkbox'
                                          ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                            >
                              {activity.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              {activity.type === 'button' && (
                                <span className="font-medium">"{activity.text}"</span>
                              )}
                              {activity.type === 'link' && (
                                <span>
                                  {activity.text && (
                                    <span className="font-medium">"{activity.text}"</span>
                                  )}
                                  {activity.url && (
                                    <span className="ml-1 text-muted-foreground text-xs break-all">
                                      → {activity.url}
                                    </span>
                                  )}
                                </span>
                              )}
                              {activity.type === 'input' && (
                                <span>
                                  <span className="text-muted-foreground">
                                    {activity.inputType}
                                  </span>
                                  {activity.text && (
                                    <span className="ml-1 font-medium">"{activity.text}"</span>
                                  )}
                                </span>
                              )}
                              {activity.type === 'select' && (
                                <span>
                                  {activity.text ? (
                                    <span className="font-medium">"{activity.text}"</span>
                                  ) : (
                                    <span className="text-muted-foreground">dropdown</span>
                                  )}
                                </span>
                              )}
                              {activity.type === 'checkbox' && (
                                <span>
                                  {activity.text ? (
                                    <span className="font-medium">"{activity.text}"</span>
                                  ) : (
                                    <span className="text-muted-foreground">checkbox</span>
                                  )}
                                </span>
                              )}
                              {activity.type === 'other' && activity.text && (
                                <span className="font-medium">"{activity.text}"</span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDateTime(activity.timestamp)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Storage Keys */}
          {report.metadata?.storageKeys &&
            (report.metadata.storageKeys.cookies?.length > 0 ||
              report.metadata.storageKeys.localStorage?.length > 0 ||
              report.metadata.storageKeys.sessionStorage?.length > 0) && (
              <Collapsible>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="flex-row items-center justify-between space-y-0 cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardTitle>
                        Storage Keys
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          (
                          {(report.metadata.storageKeys.cookies?.length || 0) +
                            (report.metadata.storageKeys.localStorage?.length || 0) +
                            (report.metadata.storageKeys.sessionStorage?.length || 0)}
                          )
                        </span>
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                                Type
                              </th>
                              <th className="text-left py-2 font-medium text-muted-foreground">
                                Key
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.metadata.storageKeys.cookies?.map((key: string, i: number) => (
                              <tr key={`cookie-${i}`} className="border-b border-muted/50">
                                <td className="py-1.5 pr-4">
                                  <Badge variant="outline" className="text-xs">
                                    Cookie
                                  </Badge>
                                </td>
                                <td className="py-1.5 font-mono text-xs break-all">{key}</td>
                              </tr>
                            ))}
                            {report.metadata.storageKeys.localStorage?.map(
                              (key: string, i: number) => (
                                <tr key={`local-${i}`} className="border-b border-muted/50">
                                  <td className="py-1.5 pr-4">
                                    <Badge variant="outline" className="text-xs">
                                      Local
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 font-mono text-xs break-all">{key}</td>
                                </tr>
                              ),
                            )}
                            {report.metadata.storageKeys.sessionStorage?.map(
                              (key: string, i: number) => (
                                <tr key={`session-${i}`} className="border-b border-muted/50">
                                  <td className="py-1.5 pr-4">
                                    <Badge variant="outline" className="text-xs">
                                      Session
                                    </Badge>
                                  </td>
                                  <td className="py-1.5 font-mono text-xs break-all">{key}</td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

        </div>

        {/* Sidebar —— 仅放「查看」类只读信息 */}
        <div className="space-y-6">
          {/* lula 2026-06-17: 详情卡降级为「基本信息」——状态/优先级/处理人已上移到顶部操作区 */}
          <Card>
            <CardHeader>
              <CardTitle>{t('reportDetail.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('reportDetail.source')}</Label>
                <div>
                  <SourceBadge source={report.source} />
                </div>
              </div>
              {manualChannel && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t('reportDetail.channel')}</Label>
                  <p className="text-sm capitalize">{manualChannel}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-muted-foreground">{t('reportDetail.created')}</Label>
                <p className="text-sm">{formatDateTime(report.createdAt)}</p>
              </div>
              {(report.reporterEmail || report.reporterName) && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t('reportDetail.reporter')}</Label>
                  {report.reporterName && (
                    <p className="text-sm">{report.reporterName}</p>
                  )}
                  {report.reporterEmail && (
                    <p className="text-sm text-muted-foreground">{report.reporterEmail}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Page Info */}
          {hasPageInfo && (
            <Card>
              <CardHeader>
                <CardTitle>{t('reportDetail.pageInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label={t('reportDetail.url')} value={report.metadata?.url} isLink />
                <InfoRow label={t('reportDetail.pageTitle')} value={report.metadata?.title} />
                <InfoRow label={t('reportDetail.referrer')} value={report.metadata?.referrer} isLink />
                <InfoRow
                  label={t('reportDetail.loadTime')}
                  value={
                    report.metadata?.pageLoadTime ? `${report.metadata.pageLoadTime}ms` : undefined
                  }
                />
                <InfoRow label={t('reportDetail.timezone')} value={report.metadata?.timezone} />
              </CardContent>
            </Card>
          )}

          {/* Environment */}
          {hasEnvironment && (
            <Card>
              <CardHeader>
                <CardTitle>{t('reportDetail.environment')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow
                  label={t('reportDetail.browser')}
                  value={formatEnvironmentValue(
                    report.metadata?.browser?.name,
                    report.metadata?.browser?.version,
                  )}
                />
                <InfoRow
                  label={t('reportDetail.os')}
                  value={formatEnvironmentValue(
                    report.metadata?.device?.os,
                    report.metadata?.device?.osVersion,
                  )}
                />
                <InfoRow label={t('reportDetail.device')} value={report.metadata?.device?.type} />
                <InfoRow
                  label={t('reportDetail.viewport')}
                  value={
                    report.metadata?.viewport?.width && report.metadata?.viewport?.height
                      ? `${report.metadata.viewport.width}x${report.metadata.viewport.height}`
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}

          {report.source === 'manual' && !hasPageInfo && !hasEnvironment && (
            <Card>
              <CardHeader>
                <CardTitle>{t('reportDetail.manualReport')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  This report was created manually in {appName} and does not include widget capture data.
                </p>
                {manualChannel && <InfoRow label="Channel" value={manualChannel} />}
              </CardContent>
            </Card>
          )}

          {/* Forwarded To */}
          {report.forwardedTo && report.forwardedTo.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('reportDetail.forwardedTo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.forwardedTo.map((ref, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {ref.type}
                        </Badge>
                        <span className="text-sm">#{ref.id}</span>
                      </div>
                      {ref.url && (
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                        >
                          {t('reportDetail.view')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* GitHub Sync Status */}
          {(report.githubSyncStatus || report.githubIssueUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  {t('reportDetail.githubSync')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.githubSyncStatus === 'synced' && report.githubIssueUrl && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">{t('reports.githubIssue', { number: report.githubIssueNumber })}</span>
                    </div>
                    <a
                      href={report.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {report.githubSyncStatus === 'pending' && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Spinner size="sm" />
                    <span className="text-sm">{t('reportDetail.syncPending')}</span>
                  </div>
                )}
                {report.githubSyncStatus === 'error' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{t('reportDetail.syncFailed')}</span>
                    </div>
                    {report.githubSyncError && (
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                        {report.githubSyncError}
                      </p>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retrySyncMutation.mutate()}
                        disabled={retrySyncMutation.isPending}
                        className="w-full"
                      >
                        {retrySyncMutation.isPending ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {t('reportDetail.retrySync')}
                      </Button>
                    )}
                  </div>
                )}
                {report.githubSyncedAt && report.githubSyncStatus === 'synced' && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {formatDateTime(report.githubSyncedAt)}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reportDetail.deleteReport')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reportDetail.deleteConfirm', { title: report.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteMutation.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value, isLink }: { label: string; value?: string; isLink?: boolean }) {
  if (!value) return null;

  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all inline-flex items-center gap-1 text-right"
        >
          {value}
          <ExternalLink className="h-3 w-3 flex-shrink-0" />
        </a>
      ) : (
        <span className="text-right">{value}</span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    open: t('dashboard.open'),
    in_progress: t('dashboard.inProgress'),
    resolved: t('dashboard.resolved'),
    closed: 'Closed',
  };

  return (
    <Badge variant="outline" className={`status-${status}`}>
      {labels[status] || status}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={`priority-${priority} uppercase text-xs`}>
      {priority}
    </Badge>
  );
}

function SourceBadge({ source }: { source?: ReportSource }) {
  const resolvedSource = source ?? 'widget';

  return (
    <Badge variant="secondary" className="uppercase text-[10px] tracking-wide">
      {resolvedSource}
    </Badge>
  );
}

function formatEnvironmentValue(...parts: Array<string | undefined>) {
  const value = parts.filter(Boolean).join(' ').trim();
  return value || undefined;
}

function AssigneeDisplay({
  user,
  showEmail = false,
  size = 'md',
}: {
  user?: Pick<User, 'name' | 'email' | 'avatarUrl'>;
  showEmail?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  if (!user) {
    return <p className="text-sm text-muted-foreground">{t('common.unassigned')}</p>;
  }

  const fallback = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  const avatarSizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const gapClass = size === 'sm' ? 'gap-2' : 'gap-3';

  return (
    <div className={`flex items-center ${gapClass}`}>
      <Avatar className={avatarSizeClass}>
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
        <AvatarFallback className="bg-bugpin-primary-100 text-bugpin-primary-700 dark:bg-bugpin-primary-900 dark:text-bugpin-primary-300 text-xs">
          {fallback}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-sm">{user.name}</p>
        {showEmail && user.email ? (
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}
