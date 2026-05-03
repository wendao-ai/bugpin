import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const en: EmailTemplate = {
  subject: 'Priority update on your bug report: {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Report Priority Updated',
    intro: 'The priority of your bug report has been updated.',
    outro: 'Thank you for your report. We will continue to keep you updated on any changes.',
  }),
};

export default en;
