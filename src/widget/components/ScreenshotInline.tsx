import { FunctionComponent } from 'preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { cn } from '../lib/utils';
import { Button } from './ui';
import { CapturedMedia } from './ScreenshotManager.js';
import { t } from '../i18n/index.js';

/**
 * ScreenshotInline —— ScreenshotManager 的精简内联版（lula 2026-06-01）。
 * 用在新合并的 WidgetDialog 里，移除 Tab 后跟表单一起单页平铺。
 *
 * 相对 ScreenshotManager：
 * - 紧凑布局：去掉中央大 drop zone 的占位，改成横向按钮条
 * - 支持粘贴上传：监听 document `bugpin:paste-file` 自定义事件（由 WidgetDialog 转发）
 * - 缩略图 grid 改 3 列，更省空间
 */

interface ScreenshotInlineProps {
  media: CapturedMedia[];
  onCapture: () => void;
  onUpload: (item: CapturedMedia) => void;
  onRemove: (id: string) => void;
  onAnnotate: (id: string) => void;
  isCapturing: boolean;
  enableAnnotation: boolean;
  maxImageSize?: number;
  maxVideoSize?: number;
}

const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

export const ScreenshotInline: FunctionComponent<ScreenshotInlineProps> = ({
  media,
  onCapture,
  onUpload,
  onRemove,
  onAnnotate,
  isCapturing,
  enableAnnotation,
  maxImageSize = DEFAULT_MAX_IMAGE_SIZE,
  maxVideoSize = DEFAULT_MAX_VIDEO_SIZE,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = (mimeType: string) => mimeType.startsWith('video/');
  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  const maxImageSizeMb = Math.round(maxImageSize / (1024 * 1024));
  const maxVideoSizeMb = Math.round(maxVideoSize / (1024 * 1024));

  const validateFile = useCallback(
    (file: File): string | null => {
      if (isImage(file.type)) {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          return `Unsupported image format: ${file.type}`;
        }
        if (file.size > maxImageSize) {
          return `Image too large. Maximum size is ${maxImageSizeMb}MB.`;
        }
      } else if (isVideo(file.type)) {
        if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
          return `Unsupported video format: ${file.type}`;
        }
        if (file.size > maxVideoSize) {
          return `Video too large. Maximum size is ${maxVideoSizeMb}MB.`;
        }
      } else {
        return `Unsupported file type: ${file.type}`;
      }
      return null;
    },
    [maxImageSize, maxImageSizeMb, maxVideoSize, maxVideoSizeMb],
  );

  const processFile = useCallback(
    async (file: File) => {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }

      setUploadError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        if (isImage(file.type)) {
          const img = new Image();
          img.onload = () => {
            const item: CapturedMedia = {
              id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              dataUrl,
              timestamp: new Date(),
              annotated: false,
              mimeType: file.type,
              width: img.width,
              height: img.height,
            };
            onUpload(item);
          };
          img.src = dataUrl;
        } else if (isVideo(file.type)) {
          const video = document.createElement('video');
          video.onloadedmetadata = () => {
            const item: CapturedMedia = {
              id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              dataUrl,
              timestamp: new Date(),
              annotated: false,
              mimeType: file.type,
              width: video.videoWidth,
              height: video.videoHeight,
            };
            onUpload(item);
          };
          video.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    },
    [validateFile, onUpload],
  );

  // lula 2026-06-01: 监听 WidgetDialog 转发的粘贴文件事件
  useEffect(() => {
    const handlePasteFile = (e: Event) => {
      const detail = (e as CustomEvent<{ file: File }>).detail;
      if (detail?.file) {
        void processFile(detail.file);
      }
    };
    document.addEventListener('bugpin:paste-file', handlePasteFile);
    return () => document.removeEventListener('bugpin:paste-file', handlePasteFile);
  }, [processFile]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          await processFile(files[i]);
        }
      }
    },
    [processFile],
  );

  const handleFileInput = useCallback(
    async (e: Event) => {
      const input = e.target as HTMLInputElement;
      const files = input.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          await processFile(files[i]);
        }
      }
      input.value = '';
    },
    [processFile],
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div class="flex flex-col gap-2">
      {/* Hint with paste support */}
      <p class="text-xs text-muted-foreground leading-relaxed">
        {t('media.inlineHint')}
      </p>

      {/* Action buttons row */}
      <div class="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onCapture}
          disabled={isCapturing}
          class="text-xs"
        >
          <svg class="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
              fill="currentColor"
            />
          </svg>
          {isCapturing ? t('media.capturing') : t('media.captureScreenshot')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          class="text-xs"
        >
          <svg class="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"
              fill="currentColor"
            />
          </svg>
          {t('media.chooseFile')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {/* Error message */}
      {uploadError && (
        <div class="flex items-center gap-2 px-2.5 py-1.5 bg-red-50 dark:bg-red-950/50 border border-solid border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-xs">
          <svg
            class="w-3.5 h-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
              fill="currentColor"
            />
          </svg>
          {uploadError}
        </div>
      )}

      {/* Media grid (only shown when there's media; empty state is the buttons above) */}
      {media.length > 0 && (
        <div
          class={cn(
            'grid grid-cols-3 gap-2 p-2 rounded border border-dashed border-border bg-muted/30 transition-colors',
            isDragging && 'border-primary bg-primary/5',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {media.map((item) => (
            <div
              key={item.id}
              class="relative rounded overflow-hidden bg-background border border-solid border-border group"
            >
              <div class="relative aspect-video bg-gray-800">
                {isVideo(item.mimeType) ? (
                  <video class="w-full h-full object-contain" src={item.dataUrl} muted />
                ) : (
                  <img class="w-full h-full object-contain" src={item.dataUrl} alt="Screenshot" />
                )}
                {/* Badges */}
                <div class="absolute top-1 left-1 flex gap-1">
                  {item.annotated && (
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300">
                      {t('media.annotated')}
                    </span>
                  )}
                  {isVideo(item.mimeType) && (
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {t('media.video')}
                    </span>
                  )}
                </div>
                {/* Hover actions overlay */}
                <div class="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {enableAnnotation && isImage(item.mimeType) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      class="w-7 h-7 bg-background/90 hover:bg-background text-foreground"
                      onClick={() => onAnnotate(item.id)}
                      title={t('media.annotate')}
                    >
                      <svg
                        class="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                          fill="currentColor"
                        />
                      </svg>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    class="w-7 h-7 bg-background/90 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 text-foreground"
                    onClick={() => onRemove(item.id)}
                    title={t('media.remove')}
                  >
                    <svg
                      class="w-3.5 h-3.5"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        fill="currentColor"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone when empty (subtle, optional) */}
      {media.length === 0 && (
        <div
          class={cn(
            'border border-dashed border-border rounded px-3 py-2 text-center text-xs text-muted-foreground transition-colors',
            isDragging && 'border-primary bg-primary/5 text-primary',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {t('media.dragOrPasteEmptyHint')}
        </div>
      )}
    </div>
  );
};
