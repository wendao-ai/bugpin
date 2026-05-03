import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const es: EmailTemplate = {
  subject: 'Actualización de prioridad de tu informe de error: {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Prioridad del informe actualizada',
    intro: 'La prioridad de tu informe de error se ha actualizado.',
    outro: 'Gracias por tu informe. Seguiremos manteniéndote al tanto de cualquier cambio.',
  }),
};

export default es;
