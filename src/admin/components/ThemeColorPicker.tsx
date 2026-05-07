import { Label } from './ui/label';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { ColorPicker } from './ui/color-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import type { ThemeColors } from '@shared/types';

interface ThemeColorPickerProps {
  value: ThemeColors;
  onChange: (colors: Partial<ThemeColors>) => void;
  disabled?: boolean;
  lightModeTitle?: string;
  darkModeTitle?: string;
  buttonColorLabel?: string;
  textColorLabel?: string;
  showGenerateButton?: boolean;
  showSurfaceColors?: boolean;
}

// Utility function to generate dark mode colors from light mode colors
function generateDarkModeColors(lightColors: {
  buttonColor: string;
  textColor: string;
  buttonHoverColor: string;
  textHoverColor: string;
  backgroundColor?: string;
  secondaryColor?: string;
  inputColor?: string;
  foregroundColor?: string;
}) {
  // Helper to parse hex color to RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Helper to convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return (
      '#' +
      [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')
    );
  };

  // Helper to lighten/darken color
  const adjustColor = (hex: string, amount: number): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const adjust = (val: number) => Math.max(0, Math.min(255, val + amount));
    return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
  };

  // Invert a color (light ↔ dark)
  const invertColor = (hex: string): string => {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  };

  const result: Partial<ThemeColors> = {
    darkButtonColor: adjustColor(lightColors.buttonColor, 80),
    darkTextColor: adjustColor(lightColors.textColor, -200),
    darkButtonHoverColor: adjustColor(lightColors.buttonHoverColor, 100),
    darkTextHoverColor: adjustColor(lightColors.textHoverColor, -200),
  };

  // Generate surface colors if light mode values are provided
  if (lightColors.backgroundColor) {
    result.darkBackgroundColor = invertColor(lightColors.backgroundColor);
  }
  if (lightColors.secondaryColor) {
    result.darkSecondaryColor = invertColor(lightColors.secondaryColor);
  }
  if (lightColors.inputColor) {
    result.darkInputColor = invertColor(lightColors.inputColor);
  }
  if (lightColors.foregroundColor) {
    result.darkForegroundColor = invertColor(lightColors.foregroundColor);
  }

  return result;
}

export function ThemeColorPicker({
  value,
  onChange,
  disabled = false,
  lightModeTitle,
  darkModeTitle,
  buttonColorLabel,
  textColorLabel,
  showGenerateButton = true,
  showSurfaceColors = false,
}: ThemeColorPickerProps) {
  const { t } = useTranslation('themeColors');
  const handleGenerateDarkColors = () => {
    const generated = generateDarkModeColors({
      buttonColor: value.lightButtonColor,
      textColor: value.lightTextColor,
      buttonHoverColor: value.lightButtonHoverColor,
      textHoverColor: value.lightTextHoverColor,
      backgroundColor: value.lightBackgroundColor,
      secondaryColor: value.lightSecondaryColor,
      inputColor: value.lightInputColor,
      foregroundColor: value.lightForegroundColor,
    });
    onChange(generated);
  };

  return (
    <Tabs defaultValue="light">
      <TabsList>
        <TabsTrigger value="light">{lightModeTitle || t('themeColors.lightModeColors')}</TabsTrigger>
        <TabsTrigger value="dark">{darkModeTitle || t('themeColors.darkModeColors')}</TabsTrigger>
      </TabsList>

      {/* Light Mode Colors */}
      <TabsContent value="light" className="space-y-3 pt-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{buttonColorLabel || t('themeColors.buttonColor')}</Label>
            <ColorPicker
              value={value.lightButtonColor}
              onChange={(color) => onChange({ lightButtonColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{textColorLabel}</Label>
            <ColorPicker
              value={value.lightTextColor}
              onChange={(color) => onChange({ lightTextColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{buttonColorLabel} (Hover)</Label>
            <ColorPicker
              value={value.lightButtonHoverColor}
              onChange={(color) => onChange({ lightButtonHoverColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{textColorLabel} (Hover)</Label>
            <ColorPicker
              value={value.lightTextHoverColor}
              onChange={(color) => onChange({ lightTextHoverColor: color })}
              disabled={disabled}
            />
          </div>
        </div>
        {showSurfaceColors && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>{t('themeColors.backgroundColor')}</Label>
              <ColorPicker
                value={value.lightBackgroundColor ?? '#ffffff'}
                onChange={(color) => onChange({ lightBackgroundColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('themeColors.secondaryColor')}</Label>
              <ColorPicker
                value={value.lightSecondaryColor ?? '#f5f5f5'}
                onChange={(color) => onChange({ lightSecondaryColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('themeColors.inputFieldColor')}</Label>
              <ColorPicker
                value={value.lightInputColor ?? '#ffffff'}
                onChange={(color) => onChange({ lightInputColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('themeColors.textColor')}</Label>
              <ColorPicker
                value={value.lightForegroundColor ?? '#0a0a0a'}
                onChange={(color) => onChange({ lightForegroundColor: color })}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </TabsContent>

      {/* Dark Mode Colors */}
      <TabsContent value="dark" className="space-y-3 pt-2">
        {showGenerateButton && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateDarkColors}
              disabled={disabled}
              type="button"
            >
              {t('themeColors.generateFromLightMode')}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{buttonColorLabel}</Label>
            <ColorPicker
              value={value.darkButtonColor}
              onChange={(color) => onChange({ darkButtonColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{textColorLabel}</Label>
            <ColorPicker
              value={value.darkTextColor}
              onChange={(color) => onChange({ darkTextColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{buttonColorLabel} (Hover)</Label>
            <ColorPicker
              value={value.darkButtonHoverColor}
              onChange={(color) => onChange({ darkButtonHoverColor: color })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label>{textColorLabel} (Hover)</Label>
            <ColorPicker
              value={value.darkTextHoverColor}
              onChange={(color) => onChange({ darkTextHoverColor: color })}
              disabled={disabled}
            />
          </div>
        </div>
        {showSurfaceColors && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Background Color</Label>
              <ColorPicker
                value={value.darkBackgroundColor ?? '#0a0a0a'}
                onChange={(color) => onChange({ darkBackgroundColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <ColorPicker
                value={value.darkSecondaryColor ?? '#262626'}
                onChange={(color) => onChange({ darkSecondaryColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Input Field Color</Label>
              <ColorPicker
                value={value.darkInputColor ?? '#1a1a1a'}
                onChange={(color) => onChange({ darkInputColor: color })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Text Color</Label>
              <ColorPicker
                value={value.darkForegroundColor ?? '#fafafa'}
                onChange={(color) => onChange({ darkForegroundColor: color })}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
