import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const en: EmailTemplate = {
  subject: 'Your bug report has been received: {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Report Received',
    intro:
      'Thank you for submitting your bug report. Our team has received it and will review it shortly.',
    labelStatus: 'Status:',
    labelPriority: 'Priority:',
    labelSubmitted: 'Submitted:',
    outro: 'You will receive email updates when the status of your report changes.',
  }),
};

export default en;
