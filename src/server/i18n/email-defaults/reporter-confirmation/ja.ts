import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const ja: EmailTemplate = {
  subject: 'バグレポートを受け付けました：{{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'レポートを受け付けました',
    intro:
      'バグレポートをお送りいただきありがとうございます。担当チームが確認次第、対応いたします。',
    labelStatus: 'ステータス：',
    labelPriority: '優先度：',
    labelSubmitted: '送信日時：',
    outro: 'レポートのステータスが変わると、メールでお知らせします。',
  }),
};

export default ja;
