import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const nl: EmailTemplate = {
  subject: 'Prioriteit van uw bugrapport bijgewerkt: {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Prioriteit van rapport bijgewerkt',
    intro: 'De prioriteit van uw bugrapport is bijgewerkt.',
    outro: 'Bedankt voor uw rapport. We houden u op de hoogte van eventuele wijzigingen.',
  }),
};

export default nl;
