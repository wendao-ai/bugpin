import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import type { ScreenshotSettings, GlobalScreenshotSettings } from '@shared/types';

interface ScreenshotSettingsFormProps {
  value: ScreenshotSettings;
  onChange: (value: ScreenshotSettings) => void;
  globalSettings?: {
    screenshot: GlobalScreenshotSettings;
  };
  disabled?: boolean;
  showCustomToggle?: boolean;
  useCustomSettings?: boolean;
  onCustomToggle?: (enabled: boolean) => void;
}

export function ScreenshotSettingsForm({
  value,
  onChange,
  globalSettings,
  disabled = false,
  showCustomToggle = false,
  useCustomSettings = true,
  onCustomToggle,
}: ScreenshotSettingsFormProps) {
  const { t } = useTranslation('screenshotSettings');
  const effectiveUseScreenCaptureAPI =
    value.useScreenCaptureAPI ?? globalSettings?.screenshot.useScreenCaptureAPI ?? false;
  const effectiveMaxScreenshotSize =
    value.maxScreenshotSize ?? globalSettings?.screenshot.maxScreenshotSize ?? 5;
  const effectiveMaxImageUploadSizeMb =
    value.maxImageUploadSizeMb ?? globalSettings?.screenshot.maxImageUploadSizeMb ?? 10;
  const effectiveMaxVideoUploadSizeMb =
    value.maxVideoUploadSizeMb ?? globalSettings?.screenshot.maxVideoUploadSizeMb ?? 50;

  return (
    <div className="space-y-4">
      {/* Use Custom Screenshot Settings Toggle */}
      {showCustomToggle && (
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="use-custom-screenshot" className="text-sm font-medium">
              {t('screenshotSettings.useCustomSettings')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('screenshotSettings.useCustomSettingsDescription')}
            </p>
          </div>
          <Switch
            id="use-custom-screenshot"
            checked={useCustomSettings}
            onCheckedChange={(checked) => {
              onCustomToggle?.(checked);
              if (!checked) {
                // Reset to undefined when switching to global defaults
                onChange({
                  useScreenCaptureAPI: undefined,
                  maxScreenshotSize: undefined,
                  maxImageUploadSizeMb: undefined,
                  maxVideoUploadSizeMb: undefined,
                });
              }
            }}
          />
        </div>
      )}

      {/* Screenshot Settings - collapsed when custom toggle is off */}
      {(!showCustomToggle || useCustomSettings) && (
        <>
          {/* Max Screenshot Size */}
          <div className="space-y-2">
            <Label htmlFor="max-screenshot-size">{t('screenshotSettings.maxScreenshotSize')}</Label>
            <Input
              id="max-screenshot-size"
              type="number"
              min={1}
              max={50}
              value={effectiveMaxScreenshotSize}
              onChange={(e) =>
                onChange({ ...value, maxScreenshotSize: parseInt(e.target.value) || 5 })
              }
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              {t('screenshotSettings.maxScreenshotSizeDescription')}
            </p>
          </div>

          {/* Max Upload File Size */}
          <div className="space-y-2">
            <Label htmlFor="max-image-upload-size">{t('screenshotSettings.maxImageUploadSize')}</Label>
            <Input
              id="max-image-upload-size"
              type="number"
              min={1}
              max={50}
              value={effectiveMaxImageUploadSizeMb}
              onChange={(e) =>
                onChange({ ...value, maxImageUploadSizeMb: parseInt(e.target.value) || 10 })
              }
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              {t('screenshotSettings.maxImageUploadSizeDescription')}
            </p>
          </div>

          {/* Max Video Upload File Size */}
          <div className="space-y-2">
            <Label htmlFor="max-video-upload-size">{t('screenshotSettings.maxVideoUploadSize')}</Label>
            <Input
              id="max-video-upload-size"
              type="number"
              min={1}
              max={500}
              value={effectiveMaxVideoUploadSizeMb}
              onChange={(e) =>
                onChange({ ...value, maxVideoUploadSizeMb: parseInt(e.target.value) || 50 })
              }
              disabled={disabled}
            />
            <p className="text-xs text-muted-foreground">
              {t('screenshotSettings.maxVideoUploadSizeDescription')}
            </p>
          </div>

          {/* Screen Capture API Toggle */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="use-screen-capture-api">
                  {t('screenshotSettings.useScreenCaptureAPI')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('screenshotSettings.useScreenCaptureAPIDescription')}
                </p>
              </div>
              <Switch
                id="use-screen-capture-api"
                checked={effectiveUseScreenCaptureAPI}
                onCheckedChange={(checked) => onChange({ ...value, useScreenCaptureAPI: checked })}
                disabled={disabled}
              />
            </div>
            <Alert className="mt-3">
              <AlertDescription className="text-sm space-y-2">
                <p>
                  <strong>{t('screenshotSettings.domCaptureLabel')}</strong> {t('screenshotSettings.domCaptureDescription')}
                </p>
                <p>
                  <strong>{t('screenshotSettings.screenCaptureAPILabel')}</strong> {t('screenshotSettings.screenCaptureAPIDescription')}
                </p>
                <p>
                  <a
                    href="https://docs.bugpin.io/configuration/widget#screen-capture-api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t('screenshotSettings.viewDocumentation')}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </>
      )}
    </div>
  );
}
