import { FunctionComponent } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { CapturedMedia } from './ScreenshotManager.js';
import { ScreenshotInline } from './ScreenshotInline.js';
import { Button, Input, Textarea, Label } from './ui';
import { ScreenCaptureConsentDialog } from './ScreenCaptureConsentDialog.js';
import { t } from '../i18n/index.js';

// F2: 反馈类型枚举与前端的 widget 完全独立；后端 Zod 把 type 校验成枚举之一。
export type FeedbackType = 'bug' | 'feature' | 'ux' | 'other';

// lula 2026-06-01: 简化字段 —— title 字段在 UI 上表现为「问题」单字段（textarea），
// 原 description 字段不再单独录入；提交时由 App.tsx 决定怎么切分。
export interface FormData {
  title: string;
  description: string; // 保留是为了和后端字段对齐（兼容历史草稿）；前端不再单独编辑
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  type: FeedbackType | ''; // 空串 = 用户还没选，提交时 validate 拦截
  reporterEmail: string;
  reporterName: string;
}

interface WidgetDialogProps {
  onClose: () => void;
  onSubmit: (data: FormData, media: CapturedMedia[]) => void;
  onCaptureScreenshot: () => void;
  onAnnotateMedia: (id: string) => void;
  media: CapturedMedia[];
  onAddMedia: (item: CapturedMedia) => void;
  onRemoveMedia: (id: string) => void;
  isSubmitting: boolean;
  isCapturing: boolean;
  enableAnnotation: boolean;
  // Controlled state props (lifted to App for persistence across capture)
  formData: FormData;
  onFormDataChange: (data: FormData) => void;
  showScreenCaptureConsent: boolean;
  onConsentConfirm: () => void;
  onConsentCancel: () => void;
  maxImageSize?: number;
  maxVideoSize?: number;
}

const PRIORITY_OPTIONS: Array<{ value: FormData['priority']; labelKey: string }> = [
  { value: 'lowest', labelKey: 'form.priorityLowest' },
  { value: 'low', labelKey: 'form.priorityLow' },
  { value: 'medium', labelKey: 'form.priorityMedium' },
  { value: 'high', labelKey: 'form.priorityHigh' },
  { value: 'highest', labelKey: 'form.priorityHighest' },
];

const TYPE_OPTIONS: Array<{ value: FeedbackType; labelKey: string }> = [
  { value: 'bug', labelKey: 'form.type_bug' },
  { value: 'feature', labelKey: 'form.type_feature' },
  { value: 'ux', labelKey: 'form.type_ux' },
  { value: 'other', labelKey: 'form.type_other' },
];

export const WidgetDialog: FunctionComponent<WidgetDialogProps> = ({
  onClose,
  onSubmit,
  onCaptureScreenshot,
  onAnnotateMedia,
  media,
  onAddMedia,
  onRemoveMedia,
  isSubmitting,
  isCapturing,
  enableAnnotation,
  formData,
  onFormDataChange,
  showScreenCaptureConsent,
  onConsentConfirm,
  onConsentCancel,
  maxImageSize,
  maxVideoSize,
}) => {
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const handleInputChange = useCallback(
    (field: keyof FormData, value: string) => {
      onFormDataChange({ ...formData, [field]: value });
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [formData, onFormDataChange, errors],
  );

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = t('validation.titleRequired');
    } else if (formData.title.trim().length < 4) {
      newErrors.title = t('validation.titleTooShort');
    }

    if (!formData.type) {
      newErrors.type = t('validation.typeRequired');
    }

    if (!formData.reporterName.trim()) {
      newErrors.reporterName = t('validation.reporterNameRequired');
    }

    if (formData.reporterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.reporterEmail)) {
      newErrors.reporterEmail = t('validation.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      onSubmit(formData, media);
    },
    [formData, media, validate, onSubmit],
  );

  // lula 2026-06-01: 粘贴上传图片。监听对话框范围内的 paste 事件，把剪贴板里的
  // 图片文件丢给 onAddMedia（走和拖拽相同的处理流程）。
  useEffect(() => {
    if (showScreenCaptureConsent) return; // 同意页打开时不响应

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;

      e.preventDefault();
      // 复用 ScreenshotInline 的 processFile —— 通过自定义事件传给它
      imageFiles.forEach((file) => {
        document.dispatchEvent(
          new CustomEvent('bugpin:paste-file', { detail: { file } }),
        );
      });
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [showScreenCaptureConsent]);

  return (
    <div class="fixed inset-0 z-[2147483646] bg-black/50 flex items-center justify-center p-5 animate-[fadeIn_0.2s_ease-out]">
      <div
        class="relative w-full max-w-2xl max-h-[90vh] bg-background border border-solid border-border rounded shadow-lg overflow-hidden flex flex-col animate-[slideUp_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bugpin-title"
      >
        {/* Header */}
        <div class="flex items-center justify-between px-5 py-3 border-b border-solid border-border">
          <h1 id="bugpin-title" class="text-base font-semibold">
            {t('widget.reportBug')}
          </h1>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('widget.close')}>
            <svg class="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                fill="currentColor"
              />
            </svg>
          </Button>
        </div>

        {showScreenCaptureConsent ? (
          <ScreenCaptureConsentDialog onConfirm={onConsentConfirm} onCancel={onConsentCancel} />
        ) : (
          <>
            {/* Body — 单页平铺，无 Tab */}
            <div class="flex-1 overflow-y-auto px-5 py-4">
              <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
                {/* 问题（合并 title + description）*/}
                <div class="flex flex-col gap-1.5">
                  <Label for="bugpin-content-input" required>
                    {t('form.content')}
                  </Label>
                  <Textarea
                    id="bugpin-content-input"
                    placeholder={t('form.contentPlaceholder')}
                    value={formData.title}
                    onInput={(e) =>
                      handleInputChange('title', (e.target as HTMLTextAreaElement).value)
                    }
                    class="min-h-24"
                    aria-describedby={errors.title ? 'bugpin-content-error' : undefined}
                  />
                  {errors.title && (
                    <span id="bugpin-content-error" class="text-destructive text-xs mt-0.5">
                      {errors.title}
                    </span>
                  )}
                </div>

                {/* 类型 + 优先级 同一行 */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 反馈类型 radio 组 */}
                  <div class="flex flex-col gap-1.5">
                    <Label required>{t('form.type')}</Label>
                    <div
                      class="flex flex-wrap gap-1"
                      role="radiogroup"
                      aria-label={t('form.type')}
                      aria-describedby={errors.type ? 'bugpin-type-error' : undefined}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={formData.type === opt.value}
                          onClick={() => handleInputChange('type', opt.value)}
                          class={`px-2.5 py-1 text-xs rounded border border-solid transition-colors ${
                            formData.type === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                    {errors.type && (
                      <span id="bugpin-type-error" class="text-destructive text-xs mt-0.5">
                        {errors.type}
                      </span>
                    )}
                  </div>

                  {/* 优先级 radio 组（替换原 Select 下拉）*/}
                  <div class="flex flex-col gap-1.5">
                    <Label>{t('form.priority')}</Label>
                    <div
                      class="flex flex-wrap gap-1"
                      role="radiogroup"
                      aria-label={t('form.priority')}
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={formData.priority === opt.value}
                          onClick={() => handleInputChange('priority', opt.value)}
                          class={`px-2.5 py-1 text-xs rounded border border-solid transition-colors ${
                            formData.priority === opt.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {t(opt.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 姓名 + 邮箱 同一行 */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <Label for="bugpin-name" required>
                      {t('form.name')}
                    </Label>
                    <Input
                      id="bugpin-name"
                      type="text"
                      placeholder={t('form.namePlaceholder')}
                      value={formData.reporterName}
                      onInput={(e) =>
                        handleInputChange('reporterName', (e.target as HTMLInputElement).value)
                      }
                      error={!!errors.reporterName}
                      aria-describedby={errors.reporterName ? 'bugpin-name-error' : undefined}
                    />
                    {errors.reporterName && (
                      <span id="bugpin-name-error" class="text-destructive text-xs mt-0.5">
                        {errors.reporterName}
                      </span>
                    )}
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <Label for="bugpin-email">{t('form.email')}</Label>
                    <Input
                      id="bugpin-email"
                      type="email"
                      placeholder={t('form.emailPlaceholder')}
                      value={formData.reporterEmail}
                      onInput={(e) =>
                        handleInputChange('reporterEmail', (e.target as HTMLInputElement).value)
                      }
                      error={!!errors.reporterEmail}
                      aria-describedby={errors.reporterEmail ? 'bugpin-email-error' : undefined}
                    />
                    {errors.reporterEmail && (
                      <span id="bugpin-email-error" class="text-destructive text-xs mt-0.5">
                        {t('form.emailInvalid')}
                      </span>
                    )}
                  </div>
                </div>

                {/* 截图区域（内联，无 Tab）*/}
                <div class="flex flex-col gap-1.5">
                  <Label>
                    {media.length > 0
                      ? `${t('form.screenshots')} (${media.length})`
                      : t('form.screenshots')}
                  </Label>
                  <ScreenshotInline
                    media={media}
                    onCapture={onCaptureScreenshot}
                    onUpload={onAddMedia}
                    onRemove={onRemoveMedia}
                    onAnnotate={onAnnotateMedia}
                    isCapturing={isCapturing}
                    enableAnnotation={enableAnnotation}
                    maxImageSize={maxImageSize}
                    maxVideoSize={maxVideoSize}
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div class="flex gap-3 px-5 py-3 border-t border-solid border-border bg-muted">
              <Button variant="outline" class="flex-1" onClick={onClose} disabled={isSubmitting}>
                {t('widget.cancel')}
              </Button>
              <Button class="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <span class="w-4 h-4 border-2 border-solid border-white/30 border-t-white rounded-full animate-[spin_0.8s_linear_infinite]" />
                ) : (
                  t('widget.submitReport')
                )}
              </Button>
            </div>
          </>
        )}

        {/* Branding */}
        <div class="py-2 px-5 text-center text-xs text-muted-foreground border-t border-solid border-border bg-background">
          {t('widget.poweredBy')}{' '}
          <a
            href="https://bugpin.io"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary no-underline font-medium hover:underline hover:text-primary-hover"
          >
            BugPin
          </a>
        </div>
      </div>
    </div>
  );
};
