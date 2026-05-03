import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const es: EmailTemplate = {
  subject: 'Actualización de tu informe de error: {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Estado del informe actualizado',
    intro: 'El estado de tu informe de error se ha actualizado.',
    teamMessageLabel: 'Mensaje del equipo:',
    outro: 'Gracias por tu informe. Seguiremos manteniéndote al tanto de cualquier cambio.',
  }),
};

export default es;
