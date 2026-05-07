import { Label } from './ui/label';
import { useTranslation } from 'react-i18next';
import { Switch } from './ui/switch';
import type { ReporterNotificationSettings } from '@shared/types';

interface ReporterNotificationSettingsFormProps {
  value: Partial<ReporterNotificationSettings>;
  onChange: (value: Partial<ReporterNotificationSettings>) => void;
  globalSettings?: {
    reporterNotifications?: ReporterNotificationSettings;
  };
  disabled?: boolean;
}

export function ReporterNotificationSettingsForm({
  value,
  onChange,
  globalSettings,
  disabled = false,
}: ReporterNotificationSettingsFormProps) {
  const { t } = useTranslation('reporterNotifications');
  const effectiveEmailEnabled =
    value.emailEnabled ?? globalSettings?.reporterNotifications?.emailEnabled ?? true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="reporter-email-enabled" className="text-sm font-normal">
            {t('reporterNotifications.emailNotifications')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t('reporterNotifications.emailNotificationsDescription')}
          </p>
        </div>
        <Switch
          id="reporter-email-enabled"
          checked={effectiveEmailEnabled}
          onCheckedChange={(checked) => onChange({ ...value, emailEnabled: checked })}
          disabled={disabled}
        />
      </div>
      {effectiveEmailEnabled && (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reporter-new-report" className="text-sm font-normal">
                {t('reporterNotifications.newReports')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('reporterNotifications.newReportsDescription')}
              </p>
            </div>
            <Switch
              id="reporter-new-report"
              checked={
                value.notifyOnNewReport ??
                globalSettings?.reporterNotifications?.notifyOnNewReport ??
                true
              }
              onCheckedChange={(checked) => onChange({ ...value, notifyOnNewReport: checked })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reporter-status-change" className="text-sm font-normal">
                {t('reporterNotifications.statusChanges')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('reporterNotifications.statusChangesDescription')}</p>
            </div>
            <Switch
              id="reporter-status-change"
              checked={
                value.notifyOnStatusChange ??
                globalSettings?.reporterNotifications?.notifyOnStatusChange ??
                true
              }
              onCheckedChange={(checked) => onChange({ ...value, notifyOnStatusChange: checked })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reporter-priority-change" className="text-sm font-normal">
                {t('reporterNotifications.priorityChanges')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('reporterNotifications.priorityChangesDescription')}</p>
            </div>
            <Switch
              id="reporter-priority-change"
              checked={
                value.notifyOnPriorityChange ??
                globalSettings?.reporterNotifications?.notifyOnPriorityChange ??
                true
              }
              onCheckedChange={(checked) =>
                onChange({ ...value, notifyOnPriorityChange: checked })
              }
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reporter-assignment-change" className="text-sm font-normal">
                {t('reporterNotifications.assignmentChanges')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('reporterNotifications.assignmentChangesDescription')}
              </p>
            </div>
            <Switch
              id="reporter-assignment-change"
              checked={
                value.notifyOnAssignment ??
                globalSettings?.reporterNotifications?.notifyOnAssignment ??
                true
              }
              onCheckedChange={(checked) => onChange({ ...value, notifyOnAssignment: checked })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reporter-messaging" className="text-sm font-normal">
                {t('reporterNotifications.messagingSystem')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('reporterNotifications.messagingSystemDescription')}
              </p>
            </div>
            <Switch
              id="reporter-messaging"
              checked={
                value.messagingEnabled ??
                globalSettings?.reporterNotifications?.messagingEnabled ??
                true
              }
              onCheckedChange={(checked) => onChange({ ...value, messagingEnabled: checked })}
              disabled={disabled}
            />
          </div>
        </>
      )}
    </div>
  );
}
