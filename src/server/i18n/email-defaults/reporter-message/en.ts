import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const en: EmailTemplate = {
  subject: 'Message about your bug report: {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Message About Your Report',
    intro: '<strong>{{sender.name}}</strong> has sent you a message regarding your bug report.',
  }),
};

export default en;
