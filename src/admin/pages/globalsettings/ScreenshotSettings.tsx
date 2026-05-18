import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../../api/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { ScreenshotSettingsForm } from '../../components/ScreenshotSettingsForm';
import type { AppSettings, ScreenshotSettings as ScreenshotSettingsType } from '@shared/types';

export function ScreenshotSettings() {
  const { t } = useTranslation('screenshotSettings');
  const queryClient = useQueryClient();
  // 字段名必须与 ScreenshotSettingsForm 子组件期待的对齐——子组件读写
  // `maxScreenshotSize`，旧版本父表单用 `maxScreenshotSizeMb`，导致 onChange
  // 把新值写进旁路键，submit 时读 `maxScreenshotSizeMb`（旧值/默认值），
  // 用户输入静默丢失。统一为 `maxScreenshotSize` 即修复。
  const [formData, setFormData] = useState<ScreenshotSettingsType>({
    maxScreenshotSize: 5,
    maxImageUploadSizeMb: 10,
    maxVideoUploadSizeMb: 50,
    useScreenCaptureAPI: false,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data.settings as AppSettings;
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        maxScreenshotSize: settings.screenshot.maxScreenshotSize || 5,
        maxImageUploadSizeMb: settings.screenshot.maxImageUploadSizeMb || 10,
        maxVideoUploadSizeMb: settings.screenshot.maxVideoUploadSizeMb || 50,
        useScreenCaptureAPI: settings.screenshot.useScreenCaptureAPI || false,
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const response = await api.put('/settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(t('screenshotSettings.savedSuccessfully'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('screenshotSettings.saveFailed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      screenshot: {
        maxScreenshotSize: formData.maxScreenshotSize || 5,
        maxImageUploadSizeMb: formData.maxImageUploadSizeMb || 10,
        maxVideoUploadSizeMb: formData.maxVideoUploadSizeMb || 50,
        useScreenCaptureAPI: formData.useScreenCaptureAPI || false,
      },
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <Spinner className="mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('globalSettings.screenshotSettings')}</CardTitle>
        <CardDescription>{t('globalSettings.screenshotSettingsDescription')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <ScreenshotSettingsForm
            value={formData}
            onChange={setFormData}
            disabled={mutation.isPending}
          />

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t('common.saving')}
              </>
            ) : (
              t('system.saveChanges')
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
