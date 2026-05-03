import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const es: EmailTemplate = {
  subject: 'Mensaje sobre tu informe de error: {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Mensaje sobre tu informe',
    intro: '<strong>{{sender.name}}</strong> te ha enviado un mensaje sobre tu informe de error.',
  }),
};

export default es;
