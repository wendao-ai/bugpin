import { Label } from './ui/label';
import { useTranslation } from 'react-i18next';
import { Switch } from './ui/switch';
import type { NotificationDefaultSettings } from '@shared/types';

interface NotificationSettingsFormProps {
  value: Partial<NotificationDefaultSettings>;
  onChange: (value: Partial<NotificationDefaultSettings>) => void;
  globalSettings?: {
    notifications: NotificationDefaultSettings;
  };
  disabled?: boolean;
  showCustomToggle?: boolean;
  useCustomSettings?: boolean;
  onCustomToggle?: (enabled: boolean) => void;
}

export function NotificationSettingsForm({
  value,
  onChange,
  globalSettings,
  disabled = false,
  showCustomToggle = false,
  useCustomSettings = true,
  onCustomToggle,
}: NotificationSettingsFormProps) {
  const { t } = useTranslation('notificationSettings');
  const effectiveEmailEnabled =
    value.emailEnabled ?? globalSettings?.notifications.emailEnabled ?? true;
  const effectiveNotifyOnNewReport =
    value.notifyOnNewReport ?? globalSettings?.notifications.notifyOnNewReport ?? true;
  const effectiveNotifyOnStatusChange =
    value.notifyOnStatusChange ?? globalSettings?.notifications.notifyOnStatusChange ?? true;
  const effectiveNotifyOnPriorityChange =
    value.notifyOnPriorityChange ?? globalSettings?.notifications.notifyOnPriorityChange ?? true;
  const effectiveNotifyOnAssignment =
    value.notifyOnAssignment ?? globalSettings?.notifications.notifyOnAssignment ?? true;
  const effectiveNotifyOnDeletion =
    value.notifyOnDeletion ?? globalSettings?.notifications.notifyOnDeletion ?? true;

  return (
    <div className="space-y-4">
      {/* Use Custom Notifications Toggle */}
      {showCustomToggle && (
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="use-custom-notifications" className="text-sm font-medium">
              {t('notificationSettings.useCustomNotifications')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('notificationSettings.useCustomNotificationsDescription')}
            </p>
          </div>
          <Switch
            id="use-custom-notifications"
            checked={useCustomSettings}
            onCheckedChange={(checked) => {
              onCustomToggle?.(checked);
              if (!checked) {
                // Reset to undefined when switching to global defaults
                onChange({
                  emailEnabled: undefined,
                  notifyOnNewReport: undefined,
                  notifyOnStatusChange: undefined,
                  notifyOnPriorityChange: undefined,
                  notifyOnAssignment: undefined,
                  notifyOnDeletion: undefined,
                });
              }
            }}
          />
        </div>
      )}

      {/* Notification Settings - collapsed when custom toggle is off */}
      {(!showCustomToggle || useCustomSettings) && (
        <>
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="default-email-enabled" className="text-sm font-normal">
                {t('notificationSettings.emailNotifications')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('notificationSettings.emailNotificationsDescription')}</p>
            </div>
            <Switch
              id="default-email-enabled"
              checked={effectiveEmailEnabled}
              onCheckedChange={(checked) => onChange({ ...value, emailEnabled: checked })}
              disabled={disabled}
            />
          </div>

          {effectiveEmailEnabled && (
            <>
              {/* New Reports */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="default-new-report" className="text-sm font-normal">
                    {t('notificationSettings.newReports')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('notificationSettings.newReportsDescription')}</p>
                </div>
                <Switch
                  id="default-new-report"
                  checked={effectiveNotifyOnNewReport}
                  onCheckedChange={(checked) => onChange({ ...value, notifyOnNewReport: checked })}
                  disabled={disabled}
                />
              </div>

              {/* Status Changes */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="default-status-change" className="text-sm font-normal">
                    {t('notificationSettings.statusChanges')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('notificationSettings.statusChangesDescription')}</p>
                </div>
                <Switch
                  id="default-status-change"
                  checked={effectiveNotifyOnStatusChange}
                  onCheckedChange={(checked) =>
                    onChange({ ...value, notifyOnStatusChange: checked })
                  }
                  disabled={disabled}
                />
              </div>

              {/* Priority Changes */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="default-priority-change" className="text-sm font-normal">
                    {t('notificationSettings.priorityChanges')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('notificationSettings.priorityChangesDescription')}</p>
                </div>
                <Switch
                  id="default-priority-change"
                  checked={effectiveNotifyOnPriorityChange}
                  onCheckedChange={(checked) =>
                    onChange({ ...value, notifyOnPriorityChange: checked })
                  }
                  disabled={disabled}
                />
              </div>

              {/* Assignments */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="default-assignment" className="text-sm font-normal">
                    {t('notificationSettings.assignments')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('notificationSettings.assignmentsDescription')}</p>
                </div>
                <Switch
                  id="default-assignment"
                  checked={effectiveNotifyOnAssignment}
                  onCheckedChange={(checked) => onChange({ ...value, notifyOnAssignment: checked })}
                  disabled={disabled}
                />
              </div>

              {/* Deletions */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="default-deletion" className="text-sm font-normal">
                    {t('notificationSettings.deletions')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('notificationSettings.deletionsDescription')}</p>
                </div>
                <Switch
                  id="default-deletion"
                  checked={effectiveNotifyOnDeletion}
                  onCheckedChange={(checked) => onChange({ ...value, notifyOnDeletion: checked })}
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
