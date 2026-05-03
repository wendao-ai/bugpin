import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const ja: EmailTemplate = {
  subject: 'バグレポートに関するメッセージ：{{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'レポートに関するメッセージ',
    intro:
      '<strong>{{sender.name}}</strong> 様より、バグレポートに関するメッセージが届いています。',
  }),
};

export default ja;
