/**
 * AI 分析卡片（lula 2026-06-03）
 *
 * 展示报告的 AI 分析结果（GLM）+ PM 反馈交互。
 *
 * 状态机：
 * - 没有 ai_analysis 或 status='idle' → 显示「请求 AI 分析」按钮
 * - status='analyzing' → 显示 spinner
 * - status='awaiting_feedback' → 渲染分析 + 决策卡片（PM 一键选）
 * - status='confirmed' → 渲染分析 + 已回答的反馈 + 「重新分析」按钮
 * - status='failed' → 显示错误 + 「重试」按钮
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import { Textarea } from './ui/textarea';
import type { Report, AiAnalysisRecord, AiDecisionNeeded } from '@shared/types';
import { useState } from 'react';

interface AIAnalysisCardProps {
  reportId: string;
  report: Report;
}

export function AIAnalysisCard({ reportId, report }: AIAnalysisCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const analysis = (report.aiAnalysis ?? null) as AiAnalysisRecord | null;

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/reports/${reportId}/ai-analysis/request`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast.success(t('aiAnalysis.triggered'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('aiAnalysis.triggerFailed'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t('aiAnalysis.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis || analysis.status === 'idle' ? (
          <IdleState
            onTrigger={() => triggerMutation.mutate()}
            loading={triggerMutation.isPending}
          />
        ) : analysis.status === 'analyzing' ? (
          <AnalyzingState />
        ) : analysis.status === 'failed' ? (
          <FailedState
            analysis={analysis}
            onRetry={() => triggerMutation.mutate()}
            loading={triggerMutation.isPending}
          />
        ) : (
          <ResultView
            reportId={reportId}
            analysis={analysis}
            onRetrigger={() => triggerMutation.mutate()}
            retriggering={triggerMutation.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IdleState({ onTrigger, loading }: { onTrigger: () => void; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('aiAnalysis.idleHint')}</p>
      <Button onClick={onTrigger} disabled={loading} size="sm" className="w-full">
        {loading ? <Spinner size="sm" className="mr-2" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
        {t('aiAnalysis.requestButton')}
      </Button>
    </div>
  );
}

function AnalyzingState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <Spinner size="lg" className="text-primary" />
      <p className="text-sm text-muted-foreground">{t('aiAnalysis.analyzing')}</p>
    </div>
  );
}

function FailedState({
  analysis,
  onRetry,
  loading,
}: {
  analysis: AiAnalysisRecord;
  onRetry: () => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-2.5 rounded bg-destructive/10 text-destructive text-xs">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('aiAnalysis.failed')}</p>
          {analysis.error && <p className="mt-1 opacity-80">{analysis.error}</p>}
        </div>
      </div>
      <Button onClick={onRetry} disabled={loading} size="sm" variant="outline" className="w-full">
        {loading ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
        {t('aiAnalysis.retry')}
      </Button>
    </div>
  );
}

function ResultView({
  reportId,
  analysis,
  onRetrigger,
  retriggering,
}: {
  reportId: string;
  analysis: AiAnalysisRecord;
  onRetrigger: () => void;
  retriggering: boolean;
}) {
  const { t } = useTranslation();
  const content = analysis.content!;
  const isConfirmed = analysis.status === 'confirmed';

  return (
    <div className="space-y-4">
      {/* 状态条 */}
      <div className="flex items-center justify-between text-xs">
        <span className={`px-2 py-0.5 rounded ${isConfirmed ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
          {isConfirmed ? t('aiAnalysis.statusConfirmed') : t('aiAnalysis.statusAwaiting')}
        </span>
        <span className="text-muted-foreground">v{analysis.version}</span>
      </div>

      {/* 问题理解 */}
      <Section title={t('aiAnalysis.understanding')}>
        <p className="text-sm leading-relaxed">{content.understanding}</p>
      </Section>

      {/* 根因方向 */}
      {content.rootCause?.summary && (
        <Section title={t('aiAnalysis.rootCause')}>
          <p className="text-sm leading-relaxed">{content.rootCause.summary}</p>
        </Section>
      )}

      {/* 推荐元数据 */}
      {content.recommendedMeta && (
        <Section title={t('aiAnalysis.recommendedMeta')}>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {content.recommendedMeta.priority && (
              <span className="px-2 py-0.5 rounded bg-muted">
                {t('common.priority')}: {content.recommendedMeta.priority}
              </span>
            )}
            {content.recommendedMeta.type && (
              <span className="px-2 py-0.5 rounded bg-muted">
                {t('reports.typeLabel')}: {content.recommendedMeta.type}
              </span>
            )}
            {content.recommendedMeta.module && (
              <span className="px-2 py-0.5 rounded bg-muted">
                {t('reports.module')}: {content.recommendedMeta.module}
              </span>
            )}
          </div>
        </Section>
      )}

      {/* 决策卡片 */}
      {content.decisionsNeeded && content.decisionsNeeded.length > 0 && (
        <Section title={t('aiAnalysis.decisionsNeeded')}>
          <div className="space-y-3">
            {content.decisionsNeeded.map((decision) => (
              <DecisionCard
                key={decision.id}
                reportId={reportId}
                decision={decision}
                currentFeedback={analysis.feedback?.find((f) => f.decisionId === decision.id)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 影响面 */}
      {content.impact?.affected && content.impact.affected.length > 0 && (
        <Section title={t('aiAnalysis.affected')}>
          <ul className="text-sm list-disc list-inside space-y-0.5">
            {content.impact.affected.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {content.impact?.testHints && content.impact.testHints.length > 0 && (
        <Section title={t('aiAnalysis.testHints')}>
          <ul className="text-sm list-disc list-inside space-y-0.5">
            {content.impact.testHints.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 重新分析 */}
      <div className="pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onRetrigger}
          disabled={retriggering}
        >
          {retriggering ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          {t('aiAnalysis.reanalyze')}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </div>
  );
}

function DecisionCard({
  reportId,
  decision,
  currentFeedback,
}: {
  reportId: string;
  decision: AiDecisionNeeded;
  currentFeedback?: { decisionId: string; choice: string; note?: string };
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(currentFeedback?.note ?? '');
  const [showNote, setShowNote] = useState(!!currentFeedback?.note);

  const feedbackMutation = useMutation({
    mutationFn: async (vars: { choice: string; note?: string }) => {
      const response = await api.post(`/reports/${reportId}/ai-analysis/feedback`, {
        decisionId: decision.id,
        choice: vars.choice,
        note: vars.note,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
      toast.success(t('aiAnalysis.feedbackSaved'));
    },
    onError: (err: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t('aiAnalysis.feedbackFailed'));
    },
  });

  return (
    <div className="rounded border p-3 space-y-2.5">
      <div>
        <p className="text-sm font-medium leading-snug">{decision.question}</p>
        {decision.help && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{decision.help}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {decision.options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={feedbackMutation.isPending}
            onClick={() => feedbackMutation.mutate({ choice: opt.id, note: note || undefined })}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              currentFeedback?.choice === opt.id
                ? 'bg-primary text-primary-foreground border-primary'
                : opt.recommended
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900'
                  : 'bg-background text-foreground border-input hover:bg-muted'
            }`}
          >
            {opt.label}
            {opt.recommended && currentFeedback?.choice !== opt.id && (
              <span className="ml-1 text-[10px] opacity-60">★</span>
            )}
          </button>
        ))}
      </div>

      <div>
        {!showNote && !currentFeedback?.note ? (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowNote(true)}
          >
            {t('aiAnalysis.addNote')}
          </button>
        ) : (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('aiAnalysis.notePlaceholder')}
            rows={2}
            className="text-xs"
          />
        )}
      </div>
    </div>
  );
}
