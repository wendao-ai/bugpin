import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const it: EmailTemplate = {
  subject: 'Aggiornamento sulla tua segnalazione di bug: {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Stato della segnalazione aggiornato',
    intro: 'Lo stato della tua segnalazione di bug è stato aggiornato.',
    teamMessageLabel: 'Messaggio dal team:',
    outro:
      'Grazie per la tua segnalazione. Continueremo a tenerti aggiornato su eventuali cambiamenti.',
  }),
};

export default it;
