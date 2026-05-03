import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const es: EmailTemplate = {
  subject: 'Hemos recibido tu informe de error: {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Informe recibido',
    intro:
      'Gracias por enviar tu informe de error. Nuestro equipo lo ha recibido y lo revisará en breve.',
    labelStatus: 'Estado:',
    labelPriority: 'Prioridad:',
    labelSubmitted: 'Enviado:',
    outro: 'Recibirás notificaciones por correo cuando cambie el estado de tu informe.',
  }),
};

export default es;
