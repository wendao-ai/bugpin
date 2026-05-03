import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const it: EmailTemplate = {
  subject: 'La tua segnalazione di bug è stata ricevuta: {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Segnalazione ricevuta',
    intro:
      "Grazie per aver inviato la tua segnalazione di bug. Il nostro team l'ha ricevuta e la esaminerà a breve.",
    labelStatus: 'Stato:',
    labelPriority: 'Priorità:',
    labelSubmitted: 'Inviato:',
    outro:
      'Riceverai aggiornamenti via email ogni volta che lo stato della tua segnalazione cambierà.',
  }),
};

export default it;
