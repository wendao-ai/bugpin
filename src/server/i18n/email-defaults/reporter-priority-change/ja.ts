import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const ja: EmailTemplate = {
  subject: 'バグレポートの優先度が変更されました：{{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'レポートの優先度が更新されました',
    intro: 'お送りいただいたバグレポートの優先度が更新されました。',
    outro: 'レポートをお送りいただきありがとうございます。今後も変更があり次第お知らせします。',
  }),
};

export default ja;
