import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const en: EmailTemplate = {
  subject: 'Update on your bug report: {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Report Status Updated',
    intro: 'The status of your bug report has been updated.',
    teamMessageLabel: 'Message from the team:',
    outro: 'Thank you for your report. We will continue to keep you updated on any changes.',
  }),
};

export default en;
