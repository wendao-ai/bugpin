import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const nl: EmailTemplate = {
  subject: 'Update over uw bugrapport: {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Status van rapport bijgewerkt',
    intro: 'De status van uw bugrapport is bijgewerkt.',
    teamMessageLabel: 'Bericht van het team:',
    outro: 'Bedankt voor uw rapport. We houden u op de hoogte van eventuele wijzigingen.',
  }),
};

export default nl;
