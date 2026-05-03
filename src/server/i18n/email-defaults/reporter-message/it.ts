import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const it: EmailTemplate = {
  subject: 'Messaggio sulla tua segnalazione di bug: {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Messaggio sulla tua segnalazione',
    intro:
      '<strong>{{sender.name}}</strong> ti ha inviato un messaggio riguardo alla tua segnalazione di bug.',
  }),
};

export default it;
