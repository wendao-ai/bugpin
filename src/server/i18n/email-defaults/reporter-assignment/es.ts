import type { EmailTemplate } from '@shared/types';
import { reporterAssignmentHtml } from '../styles.js';

const es: EmailTemplate = {
  subject: '[{{project.name}}] Asignación del informe actualizada: {{report.title}}',
  html: reporterAssignmentHtml({
    headerTitle: 'Asignación actualizada',
    introWithPrevious:
      'Tu informe ha sido reasignado de <strong>{{previousAssigneeName}}</strong> a <strong>{{assignee.name}}</strong>.',
    introWithoutPrevious: 'Tu informe ha sido asignado a <strong>{{assignee.name}}</strong>.',
    labelProject: 'Proyecto:',
    labelReport: 'Informe:',
    labelStatus: 'Estado:',
    ctaViewReport: 'Ver informe',
    outro: 'Gracias por tu informe. Seguiremos manteniéndote al tanto de cualquier cambio.',
  }),
};

export default es;
