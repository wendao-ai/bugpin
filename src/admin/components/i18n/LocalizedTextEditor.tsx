import { useId, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { SUPPORTED_LOCALES } from '@shared/types';
import type { LocaleCode, LocalizedString } from '@shared/types';

const LOCALE_LABELS: Record<LocaleCode, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  nl: 'Nederlands',
  es: 'Español',
  it: 'Italiano',
  ja: '日本語',
  zh: '中文 (简体)',
};

type ProjectMode = 'inherit' | 'no-text' | 'custom';
type GlobalMode = 'builtin' | 'custom';

export interface LocalizedTextEditorProps {
  layer: 'project' | 'global';
  value: LocalizedString | null | undefined;
  onChange: (value: LocalizedString | null | undefined) => void;
  label: string;
  helpText?: string;
  builtInPreview?: Partial<Record<LocaleCode, string>>;
  disabled?: boolean;
}

function deriveProjectMode(value: LocalizedString | null | undefined): ProjectMode {
  if (value === null) return 'no-text';
  if (value === undefined) return 'inherit';
  return 'custom';
}

function deriveGlobalMode(value: LocalizedString | null | undefined): GlobalMode {
  if (value === null || value === undefined) return 'builtin';
  return 'custom';
}

export function LocalizedTextEditor({
  layer,
  value,
  onChange,
  label,
  helpText,
  builtInPreview,
  disabled = false,
}: LocalizedTextEditorProps) {
  const fieldId = useId();
  const projectMode = deriveProjectMode(value);
  const globalMode = deriveGlobalMode(value);
  const [activeTab, setActiveTab] = useState<LocaleCode>('en');

  useEffect(() => {
    if (layer === 'project' && projectMode !== 'custom') {
      setActiveTab('en');
    }
    if (layer === 'global' && globalMode !== 'custom') {
      setActiveTab('en');
    }
  }, [layer, projectMode, globalMode]);

  const customValue: LocalizedString = value && typeof value === 'object' ? value : { en: '' };

  const handleProjectModeChange = (mode: ProjectMode) => {
    if (mode === 'inherit') {
      onChange(undefined);
      return;
    }
    if (mode === 'no-text') {
      onChange(null);
      return;
    }
    if (!value || typeof value !== 'object') {
      onChange({ en: '' });
    }
  };

  const handleGlobalModeChange = (mode: GlobalMode) => {
    if (mode === 'builtin') {
      onChange(null);
      return;
    }
    if (!value || typeof value !== 'object') {
      onChange({ en: '' });
    }
  };

  const handleLocaleChange = (locale: LocaleCode, next: string) => {
    const current: LocalizedString = value && typeof value === 'object' ? value : { en: '' };
    if (locale === 'en') {
      onChange({ ...current, en: next });
      return;
    }
    if (next === '') {
      const cloned: Record<string, string> = { ...current };
      delete cloned[locale];
      onChange(cloned as LocalizedString);
      return;
    }
    onChange({ ...current, [locale]: next } as LocalizedString);
  };

  const showCustomEditor =
    (layer === 'project' && projectMode === 'custom') ||
    (layer === 'global' && globalMode === 'custom');

  const enValue = customValue.en ?? '';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        {helpText ? <p className="text-xs text-muted-foreground">{helpText}</p> : null}
      </div>

      {layer === 'project' ? (
        <div role="radiogroup" aria-label={`${label} mode`} className="flex flex-wrap gap-2">
          <ModeButton
            active={projectMode === 'inherit'}
            disabled={disabled}
            onClick={() => handleProjectModeChange('inherit')}
            label="Inherit from instance default"
          />
          <ModeButton
            active={projectMode === 'no-text'}
            disabled={disabled}
            onClick={() => handleProjectModeChange('no-text')}
            label="Override with no text"
          />
          <ModeButton
            active={projectMode === 'custom'}
            disabled={disabled}
            onClick={() => handleProjectModeChange('custom')}
            label="Override with custom text"
          />
        </div>
      ) : (
        <div role="radiogroup" aria-label={`${label} mode`} className="flex flex-wrap gap-2">
          <ModeButton
            active={globalMode === 'builtin'}
            disabled={disabled}
            onClick={() => handleGlobalModeChange('builtin')}
            label="Use built-in default"
          />
          <ModeButton
            active={globalMode === 'custom'}
            disabled={disabled}
            onClick={() => handleGlobalModeChange('custom')}
            label="Custom text"
          />
        </div>
      )}

      {showCustomEditor ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as LocaleCode)}
          className="w-full"
        >
          <TabsList className="flex flex-wrap h-auto justify-start gap-1">
            {SUPPORTED_LOCALES.map((code) => (
              <TabsTrigger key={code} value={code} className="text-xs">
                {LOCALE_LABELS[code]}
                {code === 'en' ? <span className="ml-1 text-red-500">*</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {SUPPORTED_LOCALES.map((code) => {
            const isEn = code === 'en';
            const fieldValue = customValue[code] ?? '';
            const placeholder = isEn
              ? (builtInPreview?.en ?? '')
              : enValue || builtInPreview?.[code] || '';
            return (
              <TabsContent key={code} value={code} className="mt-3">
                <div className="space-y-1">
                  <Label htmlFor={`${fieldId}-${code}`} className="text-xs">
                    {LOCALE_LABELS[code]}
                    {isEn ? (
                      <span className="ml-1 text-red-500" aria-label="required">
                        *
                      </span>
                    ) : null}
                  </Label>
                  <Input
                    id={`${fieldId}-${code}`}
                    value={fieldValue}
                    placeholder={placeholder}
                    disabled={disabled}
                    onChange={(e) => handleLocaleChange(code, e.target.value)}
                    aria-required={isEn ? true : undefined}
                  />
                  {!isEn ? (
                    <p className="text-xs text-muted-foreground">
                      Leave empty to fall back to the English value.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      ) : null}
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}

function ModeButton({ active, disabled, onClick, label }: ModeButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </Button>
  );
}
