import { Label } from './ui/label';
import { useTranslation } from 'react-i18next';
import { Switch } from './ui/switch';
import { ThemeColorPicker } from './ThemeColorPicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import type { ThemeColors } from '@shared/types';

const DEFAULT_WIDGET_COLORS: ThemeColors = {
  lightButtonColor: '#02658D',
  lightTextColor: '#ffffff',
  lightButtonHoverColor: '#024F6F',
  lightTextHoverColor: '#ffffff',
  lightBackgroundColor: '#ffffff',
  lightSecondaryColor: '#f5f5f5',
  lightInputColor: '#ffffff',
  lightForegroundColor: '#0a0a0a',
  darkButtonColor: '#02658D',
  darkTextColor: '#ffffff',
  darkButtonHoverColor: '#036F9B',
  darkTextHoverColor: '#ffffff',
  darkBackgroundColor: '#0a0a0a',
  darkSecondaryColor: '#262626',
  darkInputColor: '#1a1a1a',
  darkForegroundColor: '#fafafa',
};

interface WidgetDialogSettingsFormProps {
  value: Partial<ThemeColors>;
  onChange: (value: Partial<ThemeColors>) => void;
  globalWidgetColors?: ThemeColors;
  disabled?: boolean;
  showCustomToggle?: boolean;
  useCustomSettings?: boolean;
  onCustomToggle?: (enabled: boolean) => void;
  showCard?: boolean;
}

export function WidgetDialogSettingsForm({
  value,
  onChange,
  globalWidgetColors,
  disabled = false,
  showCustomToggle = false,
  useCustomSettings = true,
  onCustomToggle,
  showCard = true,
}: WidgetDialogSettingsFormProps) {
  const { t } = useTranslation('widgetDialog');
  // Merge value with global colors and defaults
  const currentColors: ThemeColors = {
    lightButtonColor:
      value.lightButtonColor ??
      globalWidgetColors?.lightButtonColor ??
      DEFAULT_WIDGET_COLORS.lightButtonColor,
    lightTextColor:
      value.lightTextColor ??
      globalWidgetColors?.lightTextColor ??
      DEFAULT_WIDGET_COLORS.lightTextColor,
    lightButtonHoverColor:
      value.lightButtonHoverColor ??
      globalWidgetColors?.lightButtonHoverColor ??
      DEFAULT_WIDGET_COLORS.lightButtonHoverColor,
    lightTextHoverColor:
      value.lightTextHoverColor ??
      globalWidgetColors?.lightTextHoverColor ??
      DEFAULT_WIDGET_COLORS.lightTextHoverColor,
    lightBackgroundColor:
      value.lightBackgroundColor ??
      globalWidgetColors?.lightBackgroundColor ??
      DEFAULT_WIDGET_COLORS.lightBackgroundColor,
    lightSecondaryColor:
      value.lightSecondaryColor ??
      globalWidgetColors?.lightSecondaryColor ??
      DEFAULT_WIDGET_COLORS.lightSecondaryColor,
    lightInputColor:
      value.lightInputColor ??
      globalWidgetColors?.lightInputColor ??
      DEFAULT_WIDGET_COLORS.lightInputColor,
    lightForegroundColor:
      value.lightForegroundColor ??
      globalWidgetColors?.lightForegroundColor ??
      DEFAULT_WIDGET_COLORS.lightForegroundColor,
    darkButtonColor:
      value.darkButtonColor ??
      globalWidgetColors?.darkButtonColor ??
      DEFAULT_WIDGET_COLORS.darkButtonColor,
    darkTextColor:
      value.darkTextColor ??
      globalWidgetColors?.darkTextColor ??
      DEFAULT_WIDGET_COLORS.darkTextColor,
    darkButtonHoverColor:
      value.darkButtonHoverColor ??
      globalWidgetColors?.darkButtonHoverColor ??
      DEFAULT_WIDGET_COLORS.darkButtonHoverColor,
    darkTextHoverColor:
      value.darkTextHoverColor ??
      globalWidgetColors?.darkTextHoverColor ??
      DEFAULT_WIDGET_COLORS.darkTextHoverColor,
    darkBackgroundColor:
      value.darkBackgroundColor ??
      globalWidgetColors?.darkBackgroundColor ??
      DEFAULT_WIDGET_COLORS.darkBackgroundColor,
    darkSecondaryColor:
      value.darkSecondaryColor ??
      globalWidgetColors?.darkSecondaryColor ??
      DEFAULT_WIDGET_COLORS.darkSecondaryColor,
    darkInputColor:
      value.darkInputColor ??
      globalWidgetColors?.darkInputColor ??
      DEFAULT_WIDGET_COLORS.darkInputColor,
    darkForegroundColor:
      value.darkForegroundColor ??
      globalWidgetColors?.darkForegroundColor ??
      DEFAULT_WIDGET_COLORS.darkForegroundColor,
  };

  const handleColorChange = (colors: Partial<ThemeColors>) => {
    onChange({ ...value, ...colors });
  };

  const isDisabled = disabled || (showCustomToggle && !useCustomSettings);

  const colorPicker = (
    <ThemeColorPicker value={currentColors} onChange={handleColorChange} disabled={isDisabled} showSurfaceColors />
  );

  return (
    <div className="space-y-4">
      {/* Use Custom Settings Toggle */}
      {showCustomToggle && (
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="space-y-0.5">
            <Label htmlFor="use-custom-widget-dialog" className="text-sm font-medium">
              {t('widgetDialog.useCustomSettings')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('widgetDialog.useCustomSettingsDescription')}
            </p>
          </div>
          <Switch
            id="use-custom-widget-dialog"
            checked={useCustomSettings}
            onCheckedChange={(checked) => {
              onCustomToggle?.(checked);
              if (!checked) {
                // Reset all values to undefined when switching to global defaults
                onChange({});
              }
            }}
          />
        </div>
      )}

      {/* Widget Dialog Colors - collapsed when custom toggle is off */}
      {(!showCustomToggle || useCustomSettings) && (
        <>
          {showCard ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('widgetDialog.widgetDialogColors')}</CardTitle>
                <CardDescription>
                  {t('widgetDialog.widgetDialogColorsDescription')}
                </CardDescription>
              </CardHeader>
              <CardContent>{colorPicker}</CardContent>
            </Card>
          ) : (
            <div>{colorPicker}</div>
          )}
        </>
      )}
    </div>
  );
}
