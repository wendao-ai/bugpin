import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const nl: EmailTemplate = {
  subject: 'Uw bugrapport is ontvangen: {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Rapport ontvangen',
    intro:
      'Bedankt voor het indienen van uw bugrapport. Ons team heeft het ontvangen en zal het binnenkort beoordelen.',
    labelStatus: 'Status:',
    labelPriority: 'Prioriteit:',
    labelSubmitted: 'Ingediend:',
    outro: 'U ontvangt e-mailupdates wanneer de status van uw rapport verandert.',
  }),
};

export default nl;
