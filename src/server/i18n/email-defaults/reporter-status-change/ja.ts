import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const ja: EmailTemplate = {
  subject: 'バグレポートの更新：{{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'レポートのステータスが更新されました',
    intro: 'お送りいただいたバグレポートのステータスが更新されました。',
    teamMessageLabel: 'チームからのメッセージ：',
    outro: 'レポートをお送りいただきありがとうございます。今後も変更があり次第お知らせします。',
  }),
};

export default ja;
