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
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Spinner } from '../../components/ui/spinner';
import type { AppSettings } from '@shared/types';

/**
 * AI 分析模块设置（lula 2026-06-03）
 *
 * 目前只支持 GLM（智谱）。后续要加 OpenAI 时多 provider 切换。
 * apiKey 用 password input 避免肩膀监视；不在 UI 上 echo。
 */
export function AISettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    aiEnabled: false,
    aiProvider: 'glm' as 'glm' | 'openai',
    aiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    aiApiKey: '',
    aiModel: 'glm-4-plus',
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
        aiEnabled: settings.aiEnabled ?? false,
        aiProvider: (settings.aiProvider as 'glm' | 'openai') ?? 'glm',
        aiBaseUrl: settings.aiBaseUrl ?? 'https://open.bigmodel.cn/api/paas/v4',
        aiApiKey: settings.aiApiKey ?? '',
        aiModel: settings.aiModel ?? 'glm-4-plus',
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
      toast.success(t('aiSettings.saved'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('aiSettings.saveFailed'));
    },
  });

  const handleSave = () => {
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('aiSettings.title')}</CardTitle>
        <CardDescription>{t('aiSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">{t('aiSettings.enable')}</Label>
            <p className="text-sm text-muted-foreground">
              {t('aiSettings.enableHint')}
            </p>
          </div>
          <Switch
            checked={formData.aiEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, aiEnabled: checked })}
          />
        </div>

        {/* Provider — only GLM for now, kept as input for future expansion */}
        <div className="space-y-2">
          <Label htmlFor="ai-provider">{t('aiSettings.provider')}</Label>
          <Input
            id="ai-provider"
            value={formData.aiProvider}
            onChange={(e) =>
              setFormData({ ...formData, aiProvider: e.target.value as 'glm' | 'openai' })
            }
            placeholder="glm"
          />
          <p className="text-xs text-muted-foreground">{t('aiSettings.providerHint')}</p>
        </div>

        {/* Base URL */}
        <div className="space-y-2">
          <Label htmlFor="ai-base-url">{t('aiSettings.baseUrl')}</Label>
          <Input
            id="ai-base-url"
            value={formData.aiBaseUrl}
            onChange={(e) => setFormData({ ...formData, aiBaseUrl: e.target.value })}
            placeholder="https://open.bigmodel.cn/api/paas/v4"
          />
        </div>

        {/* API Key (password) */}
        <div className="space-y-2">
          <Label htmlFor="ai-api-key">{t('aiSettings.apiKey')}</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={formData.aiApiKey}
            onChange={(e) => setFormData({ ...formData, aiApiKey: e.target.value })}
            placeholder="•••••••••••"
          />
          <p className="text-xs text-muted-foreground">{t('aiSettings.apiKeyHint')}</p>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <Label htmlFor="ai-model">{t('aiSettings.model')}</Label>
          <Input
            id="ai-model"
            value={formData.aiModel}
            onChange={(e) => setFormData({ ...formData, aiModel: e.target.value })}
            placeholder="glm-4-plus"
          />
          <p className="text-xs text-muted-foreground">{t('aiSettings.modelHint')}</p>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                {t('common.saving')}
              </>
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
