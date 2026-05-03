import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const it: EmailTemplate = {
  subject: 'Aggiornamento di priorità sulla tua segnalazione di bug: {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Priorità della segnalazione aggiornata',
    intro: 'La priorità della tua segnalazione di bug è stata aggiornata.',
    outro:
      'Grazie per la tua segnalazione. Continueremo a tenerti aggiornato su eventuali cambiamenti.',
  }),
};

export default it;
