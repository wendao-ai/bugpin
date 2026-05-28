import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { brandingApi } from '../../api/branding';
import type {
  Project,
  ProjectSettings,
  ProjectNotificationDefaults,
  WidgetLauncherButtonSettings,
  WidgetDialogSettings,
  ScreenshotSettings,
  ReporterNotificationSettings,
  ModuleRule,
} from '@shared/types';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Spinner } from '../ui/spinner';
import { WidgetDialogSettingsForm } from '../WidgetDialogSettingsForm';
import type { ThemeColors } from '@shared/types';
import { WidgetLauncherButtonSettingsForm } from '../WidgetLauncherButtonSettingsForm';
import { ScreenshotSettingsForm } from '../ScreenshotSettingsForm';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { NotificationSettingsForm } from '../NotificationSettingsForm';
import { ReporterNotificationSettingsForm } from '../ReporterNotificationSettingsForm';
import { ProjectWhitelistForm } from './ProjectWhitelistForm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Trash2, Plus } from 'lucide-react';

interface ProjectSettingsDialogProps {
  project: { id: string; name: string; settings?: ProjectSettings };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?:
    | 'assignments'
    | 'widgetDialog'
    | 'widgetLauncherButton'
    | 'screenshot'
    | 'notifications'
    | 'whitelists'
    | 'moduleRules';
}

import type { NotificationDefaultSettings } from '@shared/types';

const UNASSIGNED_VALUE = '__unassigned__';

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
  defaultTab = 'assignments',
}: ProjectSettingsDialogProps) {
  const { t } = useTranslation('projectSettings');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Widget dialog settings state (submit button, action buttons)
  const [useCustomWidgetDialog, setUseCustomWidgetDialog] = useState(false);
  const [widgetDialogSettings, setWidgetDialogSettings] = useState<Partial<ThemeColors>>({});

  // Launcher button settings state
  const [useCustomButton, setUseCustomButton] = useState(false);
  const [buttonSettings, setButtonSettings] = useState<Partial<WidgetLauncherButtonSettings>>({});

  // Screenshot settings state
  const [useCustomScreenshot, setUseCustomScreenshot] = useState(false);
  const [screenshotSettings, setScreenshotSettings] = useState<Partial<ScreenshotSettings>>({});

  // Notification settings state
  const [useCustomNotifications, setUseCustomNotifications] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<
    Partial<NotificationDefaultSettings>
  >({});

  // Reporter notification settings state
  const [reporterSettings, setReporterSettings] = useState<Partial<ReporterNotificationSettings>>({});

  // Assignment settings state
  const [defaultAssigneeUserId, setDefaultAssigneeUserId] = useState<string | null>(null);

  // Whitelist settings state
  const [useCustomWhitelist, setUseCustomWhitelist] = useState(false);
  const [whitelistSettings, setWhitelistSettings] = useState<string[]>([]);

  // F1: Module rules state — 反馈模块映射规则，pageUrl 子串匹配 → module 名
  const [moduleRules, setModuleRules] = useState<ModuleRule[]>([]);

  // Fetch project details
  const { data: projectDetail, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', project.id],
    queryFn: async () => {
      const response = await api.get(`/projects/${project.id}`);
      return response.data.project as Project;
    },
    enabled: open,
  });

  // Fetch global settings
  const { data: globalSettings, isLoading: isLoadingGlobal } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.settings;
    },
    enabled: open,
  });

  // Fetch branding config for global widget modal colors
  const { data: brandingConfig, isLoading: isLoadingBranding } = useQuery({
    queryKey: ['branding-config'],
    queryFn: brandingApi.getConfig,
    enabled: open,
    staleTime: Infinity, // Never refetch - branding config is managed globally
  });

  // Fetch notification defaults
  const { data: notificationDefaults, isLoading: isLoadingNotifications } = useQuery({
    queryKey: ['project-notification-defaults', project.id],
    queryFn: async () => {
      const response = await api.get(`/notification-preferences/projects/${project.id}/defaults`);
      return response.data.defaults as ProjectNotificationDefaults | null;
    },
    enabled: open,
  });

  const { data: assignableUsers, isLoading: isLoadingAssignableUsers } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: async () => {
      const response = await api.get('/users/assignable');
      return response.data.users as Array<{
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
      }>;
    },
    enabled: open,
  });

  // Initialize state when data loads
  useEffect(() => {
    if (projectDetail) {
      // Widget Dialog settings - using new nested structure
      const dialogSettings = projectDetail.settings?.widgetDialog;
      const hasCustomWidgetDialog =
        dialogSettings && Object.keys(dialogSettings).length > 0;
      setUseCustomWidgetDialog(!!hasCustomWidgetDialog);
      setWidgetDialogSettings(dialogSettings || {});

      // Widget Button (launcher) settings - using new nested structure
      const launcherSettings = projectDetail.settings?.widgetLauncherButton;
      const hasCustomButton =
        launcherSettings && Object.keys(launcherSettings).length > 0;
      setUseCustomButton(!!hasCustomButton);
      setButtonSettings(launcherSettings || {});

      // Screenshot settings - using new nested structure
      const screenshotConf = projectDetail.settings?.screenshot;
      const hasCustomScreenshot =
        screenshotConf && Object.keys(screenshotConf).length > 0;
      setUseCustomScreenshot(!!hasCustomScreenshot);
      setScreenshotSettings({
        useScreenCaptureAPI: screenshotConf?.useScreenCaptureAPI,
        maxScreenshotSize: screenshotConf?.maxScreenshotSize,
        maxImageUploadSizeMb: screenshotConf?.maxImageUploadSizeMb,
        maxVideoUploadSizeMb: screenshotConf?.maxVideoUploadSizeMb,
      });

      // Whitelist settings
      const security = projectDetail.settings?.security;
      const hasCustomWhitelist = security?.allowedOrigins && security.allowedOrigins.length > 0;
      setUseCustomWhitelist(!!hasCustomWhitelist);
      setWhitelistSettings(security?.allowedOrigins || []);

      // Reporter notification settings
      const reporterConf = projectDetail.settings?.reporterNotifications;
      setReporterSettings(reporterConf || {});

      // Default assignee
      setDefaultAssigneeUserId(projectDetail.settings?.defaultAssigneeUserId ?? null);

      // F1: Module rules
      setModuleRules(projectDetail.settings?.moduleRules ?? []);
    }
  }, [projectDetail]);

  // Initialize notification settings
  useEffect(() => {
    if (notificationDefaults) {
      setUseCustomNotifications(true);
      setNotificationSettings({
        emailEnabled: notificationDefaults.defaultEmailEnabled,
        notifyOnNewReport: notificationDefaults.defaultNotifyOnNewReport,
        notifyOnStatusChange: notificationDefaults.defaultNotifyOnStatusChange,
        notifyOnPriorityChange: notificationDefaults.defaultNotifyOnPriorityChange,
        notifyOnAssignment: notificationDefaults.defaultNotifyOnAssignment,
        notifyOnDeletion: notificationDefaults.defaultNotifyOnDeletion,
      });
    } else {
      setUseCustomNotifications(false);
      setNotificationSettings({});
    }
  }, [notificationDefaults]);

  // Mutation for project settings (widget, button, screenshot, whitelist)
  const projectMutation = useMutation({
    mutationFn: async (data: { settings: Partial<ProjectSettings> }) => {
      const response = await api.patch(`/projects/${project.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    },
  });

  // Mutation for notification defaults
  const notificationMutation = useMutation({
    mutationFn: async (data: Partial<ProjectNotificationDefaults>) => {
      const response = await api.patch(
        `/notification-preferences/projects/${project.id}/defaults`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notification-defaults', project.id] });
    },
  });

  // Mutation for deleting notification defaults
  const deleteNotificationMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete(
        `/notification-preferences/projects/${project.id}/defaults`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notification-defaults', project.id] });
    },
  });

  const handleSave = async () => {
    try {
      // Build settings with new nested structure
      const newSettings: Partial<ProjectSettings> = {
        ...projectDetail?.settings,
      };

      // Widget Dialog settings
      if (useCustomWidgetDialog && Object.keys(widgetDialogSettings).length > 0) {
        newSettings.widgetDialog = widgetDialogSettings as WidgetDialogSettings;
      } else {
        newSettings.widgetDialog = undefined;
      }

      // Widget Button (launcher) settings
      if (useCustomButton && Object.keys(buttonSettings).length > 0) {
        newSettings.widgetLauncherButton = buttonSettings as WidgetLauncherButtonSettings;
      } else {
        newSettings.widgetLauncherButton = undefined;
      }

      // Screenshot settings
      if (useCustomScreenshot && Object.keys(screenshotSettings).length > 0) {
        newSettings.screenshot = screenshotSettings as ScreenshotSettings;
      } else {
        newSettings.screenshot = undefined;
      }

      // Security settings (whitelist)
      if (useCustomWhitelist && whitelistSettings.length > 0) {
        newSettings.security = {
          allowedOrigins: whitelistSettings,
        };
      } else {
        newSettings.security = undefined;
      }

      // Reporter notification settings
      if (useCustomNotifications && Object.keys(reporterSettings).length > 0) {
        newSettings.reporterNotifications = reporterSettings as ProjectSettings['reporterNotifications'];
      } else {
        newSettings.reporterNotifications = undefined;
      }

      newSettings.defaultAssigneeUserId = defaultAssigneeUserId;

      // F1: Module rules — 过滤掉空 pattern / 空 module 的行（用户没填完整就别存）
      const cleanedModuleRules = moduleRules
        .map((r) => ({ pattern: r.pattern.trim(), module: r.module.trim() }))
        .filter((r) => r.pattern && r.module);
      newSettings.moduleRules = cleanedModuleRules.length > 0 ? cleanedModuleRules : undefined;

      // Save project settings
      await projectMutation.mutateAsync({
        settings: newSettings,
      });

      // Save notification settings
      if (useCustomNotifications) {
        // Convert from NotificationDefaultSettings format to ProjectNotificationDefaults format
        await notificationMutation.mutateAsync({
          defaultEmailEnabled: notificationSettings.emailEnabled,
          defaultNotifyOnNewReport: notificationSettings.notifyOnNewReport,
          defaultNotifyOnStatusChange: notificationSettings.notifyOnStatusChange,
          defaultNotifyOnPriorityChange: notificationSettings.notifyOnPriorityChange,
          defaultNotifyOnAssignment: notificationSettings.notifyOnAssignment,
          defaultNotifyOnDeletion: notificationSettings.notifyOnDeletion,
        });
      } else {
        await deleteNotificationMutation.mutateAsync();
      }

      toast.success(t('projectSettings.settingsSaved'));
      onOpenChange(false);
    } catch (err: unknown) {
      const error = err as Error & { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('projectSettings.saveFailed'));
    }
  };

  const isLoading =
    isLoadingProject ||
    isLoadingGlobal ||
    isLoadingNotifications ||
    isLoadingBranding ||
    isLoadingAssignableUsers;
  const isSaving =
    projectMutation.isPending ||
    notificationMutation.isPending ||
    deleteNotificationMutation.isPending;

  const assignableUserIds = new Set(assignableUsers?.map((user) => user.id) ?? []);
  const isMissingAssignedUser =
    !!defaultAssigneeUserId && !assignableUserIds.has(defaultAssigneeUserId);
  const defaultAssigneeSelectValue = defaultAssigneeUserId ?? UNASSIGNED_VALUE;
  const selectedAssignee = assignableUsers?.find((user) => user.id === defaultAssigneeUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] min-h-[67vh]">
        <DialogHeader>
          <DialogTitle>{t('projectSettings.title')}</DialogTitle>
          <DialogDescription>{t('projectSettings.configureSettingsFor', { name: project.name })}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Spinner className="text-primary" />
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="flex h-auto w-full flex-shrink-0 flex-wrap justify-start gap-2 rounded-xl p-2">
              <TabsTrigger value="assignments" className="px-4 py-2">
                {t('projectSettings.tabAssignments')}
              </TabsTrigger>
              <TabsTrigger value="widgetDialog" className="px-4 py-2">
                {t('projectSettings.tabWidgetDialog')}
              </TabsTrigger>
              <TabsTrigger value="widgetLauncherButton" className="px-4 py-2">
                {t('projectSettings.tabWidgetButton')}
              </TabsTrigger>
              <TabsTrigger value="screenshot" className="px-4 py-2">
                {t('projectSettings.tabScreenshot')}
              </TabsTrigger>
              <TabsTrigger value="notifications" className="px-4 py-2">
                {t('projectSettings.tabNotifications')}
              </TabsTrigger>
              <TabsTrigger value="whitelists" className="px-4 py-2">
                {t('projectSettings.tabWhitelists')}
              </TabsTrigger>
              <TabsTrigger value="moduleRules" className="px-4 py-2">
                {t('projectSettings.tabModuleRules')}
              </TabsTrigger>
            </TabsList>

            <DialogBody className="flex-1 pt-4">
              <TabsContent value="assignments" className="mt-0">
                <div className="space-y-5 rounded-xl border bg-card p-5">
                  <div className="space-y-1">
                    <Label htmlFor="default-assignee">{t('projectSettings.defaultAssigneeLabel')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('projectSettings.defaultAssigneeHint')}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    {selectedAssignee ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {selectedAssignee.avatarUrl ? (
                            <AvatarImage src={selectedAssignee.avatarUrl} alt={selectedAssignee.name} />
                          ) : null}
                          <AvatarFallback>
                            {selectedAssignee.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium">{selectedAssignee.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {selectedAssignee.email}
                          </p>
                        </div>
                      </div>
                    ) : isMissingAssignedUser ? (
                      <div className="space-y-1">
                        <p className="font-medium">{t('projectSettings.currentAssigneeUnavailable')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('projectSettings.assigneeNotReceiving')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-medium">{t('projectSettings.noDefaultAssignee')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('projectSettings.noDefaultAssigneeHint')}
                        </p>
                      </div>
                    )}
                  </div>

                  <Select
                    value={defaultAssigneeSelectValue}
                    onValueChange={(value) =>
                      setDefaultAssigneeUserId(value === UNASSIGNED_VALUE ? null : value)
                    }
                  >
                    <SelectTrigger id="default-assignee" className="h-11 max-w-xl">
                      <SelectValue placeholder={t('projectSettings.chooseDefaultAssignee')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED_VALUE}>{t('projectSettings.noDefaultAssigneeOption')}</SelectItem>
                      {isMissingAssignedUser && defaultAssigneeUserId ? (
                        <SelectItem value={defaultAssigneeUserId}>
                          {t('projectSettings.unavailableUser')}
                        </SelectItem>
                      ) : null}
                      {assignableUsers?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {isMissingAssignedUser ? (
                    <p className="text-sm text-amber-600">
                      {t('projectSettings.currentAssigneeLost')}
                    </p>
                  ) : null}
                </div>
              </TabsContent>

              {/* Widget Dialog Tab (dialog colors) */}
              <TabsContent value="widgetDialog" className="mt-0">
                <WidgetDialogSettingsForm
                  value={widgetDialogSettings}
                  onChange={setWidgetDialogSettings}
                  globalWidgetColors={brandingConfig?.widgetPrimaryColors}
                  showCustomToggle
                  useCustomSettings={useCustomWidgetDialog}
                  onCustomToggle={setUseCustomWidgetDialog}
                  showCard={false}
                />
              </TabsContent>

              {/* Widget Launcher Button Tab */}
              <TabsContent value="widgetLauncherButton" className="mt-0">
                <WidgetLauncherButtonSettingsForm
                  value={buttonSettings}
                  onChange={setButtonSettings}
                  globalSettings={globalSettings}
                  showCustomToggle
                  useCustomSettings={useCustomButton}
                  onCustomToggle={setUseCustomButton}
                  useTabs
                />
              </TabsContent>

              {/* Screenshot Tab */}
              <TabsContent value="screenshot" className="mt-0">
                <ScreenshotSettingsForm
                  value={screenshotSettings}
                  onChange={setScreenshotSettings}
                  globalSettings={globalSettings}
                  showCustomToggle
                  useCustomSettings={useCustomScreenshot}
                  onCustomToggle={setUseCustomScreenshot}
                />
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor="use-custom-notifications"
                        className="text-sm font-medium"
                      >
                        {t('projectSettings.useCustomNotifications')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('projectSettings.useCustomNotificationsHint')}
                      </p>
                    </div>
                    <Switch
                      id="use-custom-notifications"
                      checked={useCustomNotifications}
                      onCheckedChange={(checked) => {
                        setUseCustomNotifications(checked);
                        if (!checked) {
                          setNotificationSettings({});
                          setReporterSettings({});
                        }
                      }}
                    />
                  </div>
                  {useCustomNotifications && (
                    <Tabs defaultValue="team">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="team">{t('common.team')}</TabsTrigger>
                        <TabsTrigger value="reporter">{t('common.reporter')}</TabsTrigger>
                      </TabsList>
                      <TabsContent value="team" className="mt-4">
                        <NotificationSettingsForm
                          value={notificationSettings}
                          onChange={setNotificationSettings}
                          globalSettings={globalSettings}
                        />
                      </TabsContent>
                      <TabsContent value="reporter" className="mt-4">
                        <ReporterNotificationSettingsForm
                          value={reporterSettings}
                          onChange={setReporterSettings}
                          globalSettings={globalSettings}
                        />
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              </TabsContent>

              {/* Domain Whitelists Tab */}
              <TabsContent value="whitelists" className="mt-0">
                <ProjectWhitelistForm
                  value={whitelistSettings}
                  onChange={setWhitelistSettings}
                  showCustomToggle
                  useCustomSettings={useCustomWhitelist}
                  onCustomToggle={setUseCustomWhitelist}
                />
              </TabsContent>

              <TabsContent value="moduleRules" className="mt-0">
                <ModuleRulesEditor value={moduleRules} onChange={setModuleRules} />
              </TabsContent>
            </DialogBody>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t('common.saving')}
              </>
            ) : (
              t('projectSettings.saveSettings')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// F1: 反馈模块映射规则编辑器
// 一条规则 = { pattern: page URL 子串, module: 命中后落库的模块名 }
// 规则按数组顺序生效（第一个 includes 命中的 win），建议长 pattern 排前面避免被短 pattern 抢命中
function ModuleRulesEditor({
  value,
  onChange,
}: {
  value: ModuleRule[];
  onChange: (rules: ModuleRule[]) => void;
}) {
  const { t } = useTranslation('projectSettings');

  const addRule = () => onChange([...value, { pattern: '', module: '' }]);

  const updateRule = (idx: number, patch: Partial<ModuleRule>) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRule = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const moveRule = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5">
      <div className="space-y-1">
        <Label>{t('projectSettings.moduleRulesLabel')}</Label>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {t('projectSettings.moduleRulesHint')}
        </p>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          {t('projectSettings.moduleRulesEmpty')}
        </p>
      ) : (
        <div className="space-y-2">
          {/* 表头 */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-xs text-muted-foreground">
            <span>{t('projectSettings.moduleRulePatternCol')}</span>
            <span>{t('projectSettings.moduleRuleModuleCol')}</span>
            <span className="w-[88px]" />
          </div>

          {value.map((rule, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input
                placeholder="/lims/email-intake/detail/"
                value={rule.pattern}
                onChange={(e) => updateRule(idx, { pattern: e.target.value })}
              />
              <Input
                placeholder={t('projectSettings.moduleRuleModulePlaceholder')}
                value={rule.module}
                onChange={(e) => updateRule(idx, { module: e.target.value })}
              />
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveRule(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => moveRule(idx, 1)}
                  disabled={idx === value.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRule(idx)}
                  aria-label="Delete rule"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={addRule}>
        <Plus className="h-4 w-4 mr-1" />
        {t('projectSettings.moduleRulesAdd')}
      </Button>
    </div>
  );
}
