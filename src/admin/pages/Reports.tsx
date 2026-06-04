import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Search, RefreshCw, CheckCircle, AlertCircle, Trash2, X } from 'lucide-react';
import { Spinner } from '../components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { formatDate as formatAbsoluteDate } from '../lib/utils';
import type { ManualReportChannel, Report, User } from '@shared/types';

interface Project {
  id: string;
  name: string;
}

const PROJECT_DEFAULT_ASSIGNEE = '__project_default__';
const UNASSIGNED_ASSIGNEE = '__unassigned__';
const NO_CHANNEL = '__none__';

interface CreateReportFormState {
  projectId: string;
  // lula 2026-06-03: title 字段在 UI 上表现为「问题」单 textarea，
  // description 在 admin create 路径不再单独录入（保留兼容性）
  title: string;
  description: string;
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  type: 'bug' | 'feature' | 'ux' | 'other';
  assignedTo: string;
  reporterName: string;
  reporterEmail: string;
  url: string;
  channel: string;
  files: File[];
}

const PRIORITY_OPTIONS: Array<{ value: CreateReportFormState['priority']; labelKey: string }> = [
  { value: 'lowest', labelKey: 'reports.priorityLowest' },
  { value: 'low', labelKey: 'reports.priorityLow' },
  { value: 'medium', labelKey: 'reports.priorityMedium' },
  { value: 'high', labelKey: 'reports.priorityHigh' },
  { value: 'highest', labelKey: 'reports.priorityHighest' },
];

const TYPE_OPTIONS: Array<{ value: CreateReportFormState['type']; labelKey: string }> = [
  { value: 'bug', labelKey: 'reports.typeBug' },
  { value: 'feature', labelKey: 'reports.typeFeature' },
  { value: 'ux', labelKey: 'reports.typeUx' },
  { value: 'other', labelKey: 'reports.typeOther' },
];

function buildCreateReportForm(defaultProjectId?: string): CreateReportFormState {
  return {
    projectId: defaultProjectId ?? '',
    title: '',
    description: '',
    priority: 'medium',
    type: 'bug',
    assignedTo: PROJECT_DEFAULT_ASSIGNEE,
    reporterName: '',
    reporterEmail: '',
    url: '',
    channel: NO_CHANNEL,
    files: [],
  };
}

function normalizeManualReportUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

export function Reports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManageReports = user?.role === 'admin' || user?.role === 'editor';
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateReportFormState>(() =>
    buildCreateReportForm(searchParams.get('projectId') || undefined),
  );
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // 跳转到详情页时把当前列表 URL 通过 history state 带过去，
  // ReportDetail 里的「返回」+ 删除后跳回会回到带筛选的同一个 URL
  const goToReportDetail = (reportId: string) => {
    navigate(`/reports/${reportId}`, {
      state: { fromList: location.pathname + location.search },
    });
  };

  const page = parseInt(searchParams.get('page') || '1');
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const projectId = searchParams.get('projectId') || '';
  const assignedTo = searchParams.get('assignedTo') || '';
  const source = searchParams.get('source') || '';
  const moduleFilter = searchParams.get('module') || '';
  const typeFilter = searchParams.get('type') || '';

  // Fetch projects for filter
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/projects');
      return response.data.projects as Project[];
    },
  });

  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: async () => {
      const response = await api.get('/users/assignable');
      return response.data.users as User[];
    },
    enabled: canManageReports,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'reports',
      { page, status, priority, projectId, assignedTo, source, moduleFilter, typeFilter, search: searchParams.get('search') },
    ],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (projectId) params.projectId = projectId;
      if (assignedTo) params.assignedTo = assignedTo;
      if (source) params.source = source;
      if (moduleFilter) params.module = moduleFilter;
      if (typeFilter) params.type = typeFilter;
      if (searchParams.get('search')) params.search = searchParams.get('search')!;

      const response = await api.get('/reports', { params });
      return response.data;
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });

  const createReportMutation = useMutation({
    mutationFn: async (form: CreateReportFormState) => {
      const formData = new FormData();
      const payload = {
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        type: form.type,
        assignedTo:
          form.assignedTo === PROJECT_DEFAULT_ASSIGNEE
            ? undefined
            : form.assignedTo === UNASSIGNED_ASSIGNEE
              ? null
              : form.assignedTo,
        reporterName: form.reporterName.trim() || undefined,
        reporterEmail: form.reporterEmail.trim() || undefined,
        url: normalizeManualReportUrl(form.url) || undefined,
        channel: form.channel === NO_CHANNEL ? undefined : (form.channel as ManualReportChannel),
      };

      formData.append('data', JSON.stringify(payload));
      for (const file of form.files) {
        formData.append('files', file);
      }

      const response = await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.report as Report;
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['recent-reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowCreateDialog(false);
      setCreateForm(buildCreateReportForm(report.projectId));
      toast.success(t('reports.createdSuccess'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, t('reports.failedCreate')));
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({
      ids,
      updates,
    }: {
      ids: string[];
      updates: { status?: string; priority?: string; assignedTo?: string | null };
    }) => {
      const response = await api.post('/reports/bulk-update', { ids, updates });
      return { data: response.data, count: ids.length, updates };
    },
    onSuccess: ({ count, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedIds(new Set());

      // Show appropriate toast message
      if (updates.status) {
        const statusLabel = updates.status.replace('_', ' ');
        toast.success(t('reports.updatedStatus', { status: statusLabel, count }));
      } else if (updates.priority) {
        toast.success(t('reports.updatedPriority', { priority: updates.priority, count }));
      } else if (updates.assignedTo !== undefined) {
        const assigneeName =
          updates.assignedTo === null
            ? 'unassigned'
            : assignableUsers.find((assignee) => assignee.id === updates.assignedTo)?.name ||
              'updated assignee';
        toast.success(
          updates.assignedTo === null
            ? t('reports.unassignedReports', { count })
            : t('reports.assignedTo', { count, name: assigneeName }),
        );
      }
    },
    onError: (error) => {
      // lula 2026-05-28：把后端的真实错误冒出来，方便定位指派失败的具体原因
      toast.error(getApiErrorMessage(error, t('reports.failedUpdate')));
    },
  });

  // Bulk delete mutation (delete each report individually)
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.delete(`/reports/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);

      toast.success(t('reports.deletedReports', { count }));
    },
    onError: () => {
      toast.error(t('reports.failedDelete'));
    },
  });

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.data) {
      setSelectedIds(new Set(data.data.map((r: Report) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openCreateDialog = () => {
    setCreateForm(buildCreateReportForm(projectId || projectsData?.[0]?.id));
    setShowCreateDialog(true);
  };

  const updateCreateForm = <K extends keyof CreateReportFormState>(
    key: K,
    value: CreateReportFormState[K],
  ) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  };

  // Bulk action handlers
  const handleBulkStatusUpdate = (newStatus: string) => {
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      updates: { status: newStatus },
    });
  };

  // lula 2026-06-01：指派列内联可编辑，直接从 assignableUsers 选（含自己），不再用 ASSIGN_TO_ME 特殊项
  const handleAssigneeChange = (reportId: string, value: string) => {
    const assignedTo: string | null = value === UNASSIGNED_ASSIGNEE ? null : value;
    bulkUpdateMutation.mutate({
      ids: [reportId],
      updates: { assignedTo },
    });
  };

  // lula 2026-05-28：状态列内联可编辑（单条快捷更新，复用 bulkUpdateMutation 单元素分支）
  const handleStatusChange = (reportId: string, newStatus: string) => {
    bulkUpdateMutation.mutate({
      ids: [reportId],
      updates: { status: newStatus },
    });
  };

  const handleBulkPriorityUpdate = (newPriority: string) => {
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      updates: { priority: newPriority },
    });
  };

  const handleBulkAssigneeUpdate = (assigneeId: string | null) => {
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      updates: { assignedTo: assigneeId },
    });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();
    createReportMutation.mutate(createForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-muted-foreground">{t('reports.manage')}</p>
        </div>
        {canManageReports && (
          <Button onClick={openCreateDialog} className="sm:shrink-0">
            {t('reports.createReport')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('reports.searchReports')}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Status filter */}
            <Select
              value={status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('reports.allStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allStatus')}</SelectItem>
                <SelectItem value="open">{t('dashboard.open')}</SelectItem>
                <SelectItem value="in_progress">{t('dashboard.inProgress')}</SelectItem>
                <SelectItem value="developed">{t('dashboard.developed')}</SelectItem>
                <SelectItem value="resolved">{t('dashboard.resolved')}</SelectItem>
                <SelectItem value="closed">{t('dashboard.closed')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority filter */}
            <Select
              value={priority || 'all'}
              onValueChange={(value) => handleFilterChange('priority', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('reports.allPriority')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allPriority')}</SelectItem>
                <SelectItem value="highest">{t('reports.priorityHighest')}</SelectItem>
                <SelectItem value="high">{t('reports.priorityHigh')}</SelectItem>
                <SelectItem value="medium">{t('reports.priorityMedium')}</SelectItem>
                <SelectItem value="low">{t('reports.priorityLow')}</SelectItem>
                <SelectItem value="lowest">{t('reports.priorityLowest')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Project filter */}
            <Select
              value={projectId || 'all'}
              onValueChange={(value) => handleFilterChange('projectId', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('reports.allProjects')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allProjects')}</SelectItem>
                {projectsData?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canManageReports && (
              <Select
                value={assignedTo || 'all'}
                onValueChange={(value) => handleFilterChange('assignedTo', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('reports.allAssignees')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.allAssignees')}</SelectItem>
                  {assignableUsers.map((assignee) => (
                    <SelectItem key={assignee.id} value={assignee.id}>
                      <AssigneeDisplay user={assignee} compact />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={source || 'all'}
              onValueChange={(value) => handleFilterChange('source', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('reports.allSources')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allSources')}</SelectItem>
                <SelectItem value="widget">{t('widget.widget')}</SelectItem>
                <SelectItem value="manual">{t('reports.sourceManual')}</SelectItem>
              </SelectContent>
            </Select>

            {/* F2: 反馈类型筛选 */}
            <Select
              value={typeFilter || 'all'}
              onValueChange={(value) => handleFilterChange('type', value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('reports.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allTypes')}</SelectItem>
                <SelectItem value="bug">{t('reports.type_bug')}</SelectItem>
                <SelectItem value="feature">{t('reports.type_feature')}</SelectItem>
                <SelectItem value="ux">{t('reports.type_ux')}</SelectItem>
                <SelectItem value="other">{t('reports.type_other')}</SelectItem>
              </SelectContent>
            </Select>

            {/* F1: 反馈模块筛选。下拉项来自当前列表里出现过的 module 值 + 「未分类」 */}
            <Select
              value={moduleFilter || 'all'}
              onValueChange={(value) => handleFilterChange('module', value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('reports.allModules')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('reports.allModules')}</SelectItem>
                <SelectItem value="__unmatched__">{t('reports.moduleUnmatched')}</SelectItem>
                {Array.from(
                  new Set<string>(
                    ((data?.data ?? []) as Report[])
                      .map((r) => r.module)
                      .filter((m): m is string => typeof m === 'string' && m.length > 0),
                  ),
                )
                  .sort()
                  .map((m: string) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions toolbar */}
      {selectedIds.size > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {t('reports.selected', { count: selectedIds.size })}
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  {t('common.clear')}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {/* Status dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={bulkUpdateMutation.isPending}>
                      {t('reports.setStatus')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('open')}>
                      {t('dashboard.open')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('in_progress')}>
                      {t('dashboard.inProgress')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('developed')}>
                      {t('dashboard.developed')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('resolved')}>
                      {t('dashboard.resolved')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkStatusUpdate('closed')}>
                      {t('dashboard.closed')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Priority dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={bulkUpdateMutation.isPending}>
                      {t('reports.setPriority')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkPriorityUpdate('highest')}>
                      {t('reports.priorityHighest')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkPriorityUpdate('high')}>
                      {t('reports.priorityHigh')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkPriorityUpdate('medium')}>
                      {t('reports.priorityMedium')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkPriorityUpdate('low')}>
                      {t('reports.priorityLow')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkPriorityUpdate('lowest')}>
                      {t('reports.priorityLowest')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {canManageReports && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={bulkUpdateMutation.isPending}>
                        {t('reports.assign')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleBulkAssigneeUpdate(null)}>
                        {t('reports.unassign')}
                      </DropdownMenuItem>
                      {assignableUsers.map((assignee) => (
                        <DropdownMenuItem
                          key={assignee.id}
                          onClick={() => handleBulkAssigneeUpdate(assignee.id)}
                        >
                          <AssigneeDisplay user={assignee} />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Delete button */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('common.delete')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('reports.createReportTitle')}</DialogTitle>
            <DialogDescription>
              {t('reports.createReportDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateReport} className="space-y-4">
            {/* lula 2026-06-03: 重做布局，跟 widget 表单一致 —— 单问题 textarea + button radio */}

            {/* 项目 + 渠道 同一行 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-report-project">{t('reports.projectLabel')}</Label>
                <Select
                  value={createForm.projectId}
                  onValueChange={(value) => updateCreateForm('projectId', value)}
                >
                  <SelectTrigger id="create-report-project">
                    <SelectValue placeholder={t('reports.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsData?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-report-channel">{t('reports.channelLabel')}</Label>
                <Select
                  value={createForm.channel}
                  onValueChange={(value) => updateCreateForm('channel', value)}
                >
                  <SelectTrigger id="create-report-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CHANNEL}>{t('reports.noChannel')}</SelectItem>
                    <SelectItem value="email">{t('reports.channelEmail')}</SelectItem>
                    <SelectItem value="chat">{t('reports.channelChat')}</SelectItem>
                    <SelectItem value="phone">{t('reports.channelPhone')}</SelectItem>
                    <SelectItem value="qa">QA</SelectItem>
                    <SelectItem value="other">{t('reports.channelOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 问题（合并 title + description）*/}
            <div className="space-y-2">
              <Label htmlFor="create-report-content">{t('reports.contentLabel')}</Label>
              <Textarea
                id="create-report-content"
                value={createForm.title}
                onChange={(e) => updateCreateForm('title', e.target.value)}
                placeholder={t('reports.contentPlaceholder')}
                rows={4}
                required
              />
            </div>

            {/* 类型 + 优先级 (button radio) 同一行 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('reports.typeLabel')}</Label>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('reports.typeLabel')}>
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={createForm.type === opt.value}
                      onClick={() => updateCreateForm('type', opt.value)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        createForm.type === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:bg-muted'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('reports.priorityLabel')}</Label>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={t('reports.priorityLabel')}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={createForm.priority === opt.value}
                      onClick={() => updateCreateForm('priority', opt.value)}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        createForm.priority === opt.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:bg-muted'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 指派 + URL 同一行 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-report-assignee">{t('reports.assigneeLabel')}</Label>
                <Select
                  value={createForm.assignedTo}
                  onValueChange={(value) => updateCreateForm('assignedTo', value)}
                >
                  <SelectTrigger id="create-report-assignee">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PROJECT_DEFAULT_ASSIGNEE}>{t('reports.useProjectDefault')}</SelectItem>
                    <SelectItem value={UNASSIGNED_ASSIGNEE}>{t('common.unassigned')}</SelectItem>
                    {assignableUsers.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-report-url">{t('reports.urlLabel')}</Label>
                <Input
                  id="create-report-url"
                  type="text"
                  inputMode="url"
                  value={createForm.url}
                  onChange={(e) => updateCreateForm('url', e.target.value)}
                  onBlur={(e) => updateCreateForm('url', normalizeManualReportUrl(e.target.value))}
                  placeholder={t('reports.urlPlaceholder')}
                />
              </div>
            </div>

            {/* 反馈人姓名 + 邮箱 同一行 */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-report-reporter-name">{t('reports.reporterName')}</Label>
                <Input
                  id="create-report-reporter-name"
                  value={createForm.reporterName}
                  onChange={(e) => updateCreateForm('reporterName', e.target.value)}
                  placeholder={t('common.optional')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-report-reporter-email">{t('reports.reporterEmail')}</Label>
                <Input
                  id="create-report-reporter-email"
                  type="email"
                  value={createForm.reporterEmail}
                  onChange={(e) => updateCreateForm('reporterEmail', e.target.value)}
                  placeholder={t('common.optional')}
                />
              </div>
            </div>

            {/* 文件附件 */}
            <div className="space-y-2">
              <Label htmlFor="create-report-files">{t('reports.filesLabel')}</Label>
              <Input
                id="create-report-files"
                type="file"
                multiple
                accept="image/*,video/*,application/pdf,text/plain,application/json,.json,.txt,.pdf"
                onChange={(e) => updateCreateForm('files', Array.from(e.target.files ?? []))}
              />
              {createForm.files.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('reports.filesSelected', { count: createForm.files.length })}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={createReportMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createReportMutation.isPending || !createForm.projectId}
              >
                {createReportMutation.isPending ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    {t('common.creating')}
                  </>
                ) : (
                  t('reports.createReport')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('reports.deleteReports', { count: selectedIds.size })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('reports.deleteReportsDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {t('common.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reports — mobile card list */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="text-primary" />
          </div>
        ) : data?.data?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">{t('reports.noReportsFound')}</CardContent>
          </Card>
        ) : (
          data?.data?.map((report: Report) => (
            <Card
              key={report.id}
              className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(report.id) ? 'bg-muted/30' : ''}`}
              onClick={() => goToReportDetail(report.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div onClick={(e) => e.stopPropagation()} className="mt-0.5">
                    <Checkbox
                      checked={selectedIds.has(report.id)}
                      onCheckedChange={(checked) => handleSelectOne(report.id, checked as boolean)}
                      aria-label={t('reports.selectReport', { title: report.title })}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {report.metadata?.url || t('reports.noUrl')}
                    </p>
                    {report.reporterEmail && (
                      <p className="text-xs text-muted-foreground">
                        {report.reporterName || report.reporterEmail}
                      </p>
                    )}
                    <div className="mt-2">
                      <AssigneeDisplay user={report.assignee} compact />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <StatusBadge status={report.status} />
                      <PriorityBadge priority={report.priority} />
                      <TypeBadge type={report.type} />
                      {report.module && (
                        <Badge variant="outline" className="text-xs">
                          {report.module}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {report.projectName || t('common.unknown')}
                      </span>
                      <GitHubSyncIcon report={report} />
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('reports.page', { current: data.page, total: data.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleFilterChange('page', String(page - 1))} disabled={page <= 1}>{t('common.previous')}</Button>
              <Button variant="outline" size="sm" onClick={() => handleFilterChange('page', String(page + 1))} disabled={page >= data.totalPages}>{t('common.next')}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Reports table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    data?.data?.length > 0 &&
                    data.data.every((r: Report) => selectedIds.has(r.id))
                  }
                  onCheckedChange={handleSelectAll}
                  aria-label={t('reports.report')}
                />
              </TableHead>
              {/* lula 2026-06-01：稳定 ID 列（取 report.id 后 8 位 hex），用户在沟通时引用 */}
              <TableHead className="w-[100px] text-muted-foreground">ID</TableHead>
              <TableHead>{t('reports.report')}</TableHead>
              <TableHead>{t('reports.project')}</TableHead>
              <TableHead>{t('dashboard.reporter')}</TableHead>
              <TableHead>{t('reports.module')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('common.priority')}</TableHead>
              <TableHead>{t('reports.assignee')}</TableHead>
              <TableHead className="w-[50px]">
                <RefreshCw className="h-4 w-4" />
              </TableHead>
              <TableHead>{t('reports.created')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <Spinner className="mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : data?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  {t('reports.noReportsFound')}
                </TableCell>
              </TableRow>
            ) : (
              data?.data?.map((report: Report) => (
                <TableRow
                  key={report.id}
                  className={`cursor-pointer hover:bg-muted/50 ${selectedIds.has(report.id) ? 'bg-muted/30' : ''}`}
                  onClick={() => goToReportDetail(report.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(report.id)}
                      onCheckedChange={(checked) => handleSelectOne(report.id, checked as boolean)}
                      aria-label={t('reports.selectReport', { title: report.title })}
                    />
                  </TableCell>
                  {/* lula 2026-06-01：稳定 issue ID = 项目缩写 + 自增序号（如 MIGE-7），便于沟通时引用 */}
                  <TableCell
                    className="text-foreground text-xs font-mono tabular-nums whitespace-nowrap"
                    title={`${report.id}（点击复制）`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const display = formatReportShortId(report);
                      navigator.clipboard?.writeText(display);
                      toast.success(t('reports.idCopied'));
                    }}
                  >
                    {formatReportShortId(report)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{report.title}</p>
                      <TypeBadge type={report.type} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-xs">
                      {report.metadata?.url || t('reports.noUrl')}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {report.projectName || t('common.unknown')}
                    </span>
                  </TableCell>
                  {/* lula 2026-05-28：反馈人独立列 */}
                  <TableCell>
                    <span className="text-sm">
                      {report.reporterName || report.reporterEmail || '-'}
                    </span>
                  </TableCell>
                  {/* lula 2026-05-28：反馈模块独立列（对应一级页面名） */}
                  <TableCell>
                    {report.module ? (
                      <Badge variant="outline" className="text-xs">
                        {report.module}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  {/* lula 2026-05-28：状态列改可点击 Select，直接更新 */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={report.status}
                      onValueChange={(value) => handleStatusChange(report.id, value)}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs">
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
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={report.priority} />
                  </TableCell>
                  {/* lula 2026-05-28：指派列改可点击 Select，直接列出所有可指派用户（含自己） */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canManageReports ? (
                      <Select
                        value={report.assignedTo || UNASSIGNED_ASSIGNEE}
                        onValueChange={(value) => handleAssigneeChange(report.id, value)}
                      >
                        <SelectTrigger className="h-8 w-[140px] text-xs">
                          <SelectValue placeholder={t('common.unassigned')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_ASSIGNEE}>
                            {t('common.unassigned')}
                          </SelectItem>
                          {assignableUsers.map((assignee) => (
                            <SelectItem key={assignee.id} value={assignee.id}>
                              {assignee.id === user?.id
                                ? `${assignee.name}（${t('reports.you')}）`
                                : assignee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <AssigneeDisplay user={report.assignee} compact />
                    )}
                  </TableCell>
                  <TableCell>
                    <GitHubSyncIcon report={report} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(report.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('reports.pageWithTotal', { current: data.page, total: data.total })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFilterChange('page', String(page - 1))}
                disabled={page <= 1}
              >
                {t('common.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFilterChange('page', String(page + 1))}
                disabled={page >= data.totalPages}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

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

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={`priority-${priority} uppercase text-xs`}>
      {priority}
    </Badge>
  );
}

// F2: 反馈类型 chip。bug/feature/ux/other 各分配 tailwind 颜色辅助辨识。
function TypeBadge({ type }: { type: string }) {
  const palette: Record<string, string> = {
    bug: 'border-red-300 text-red-600 dark:text-red-400',
    feature: 'border-blue-300 text-blue-600 dark:text-blue-400',
    ux: 'border-amber-300 text-amber-600 dark:text-amber-400',
    other: 'border-gray-300 text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={`text-xs ${palette[type] || palette.other}`}>
      {i18next.t(`reports.type_${type}`)}
    </Badge>
  );
}

/**
 * 列表显示用的短 ID：`<项目缩写>-<seq>`，如 `MIGE-7`。
 * - 项目缩写：projectName 全字母数字部分，去空格后取前 8 个字符大写
 * - 没有 seq 的旧数据：回退到 report.id 的前 8 位 hex
 * lula 2026-06-01
 */
function formatReportShortId(report: Report): string {
  const seq = report.seq;
  const code = (report.projectName ?? '')
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 8)
    .toUpperCase();
  if (typeof seq === 'number' && code) return `${code}-${seq}`;
  if (typeof seq === 'number') return `#${seq}`;
  // 兜底：老数据 seq=null
  return report.id.split('_')[1]?.slice(0, 8) ?? report.id.slice(0, 8);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return i18next.t('reports.today');
  } else if (diffDays === 1) {
    return i18next.t('reports.yesterday');
  } else if (diffDays < 7) {
    return i18next.t('reports.daysAgo', { count: diffDays });
  } else {
    return formatAbsoluteDate(date);
  }
}

function GitHubSyncIcon({ report }: { report: Report }) {
  const { t } = useTranslation();
  if (!report.githubSyncStatus && !report.githubIssueUrl) {
    return null;
  }

  if (report.githubSyncStatus === 'synced' && report.githubIssueUrl) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={report.githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-green-600 hover:text-green-700"
            >
              <CheckCircle className="h-4 w-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('reports.githubIssue', { number: report.githubIssueNumber })}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (report.githubSyncStatus === 'pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-amber-500">
              <Spinner size="sm" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('reports.syncPending')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (report.githubSyncStatus === 'error') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-destructive">
              <AlertCircle className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('reports.syncFailed')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return null;
}

function AssigneeDisplay({
  user,
  compact = false,
}: {
  user?: Pick<User, 'name' | 'email' | 'avatarUrl'>;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  if (!user) {
    return <span className="text-sm text-muted-foreground">{t('common.unassigned')}</span>;
  }

  const fallback = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className={compact ? 'h-6 w-6' : 'h-8 w-8'}>
        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
        <AvatarFallback className="bg-bugpin-primary-100 text-bugpin-primary-700 dark:bg-bugpin-primary-900 dark:text-bugpin-primary-300 text-[10px]">
          {fallback}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm text-muted-foreground truncate">{user.name}</span>
    </div>
  );
}
