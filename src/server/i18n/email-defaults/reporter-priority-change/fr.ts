import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const fr: EmailTemplate = {
  subject: 'Mise à jour de la priorité de ton rapport de bug : {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Priorité du rapport mise à jour',
    intro: 'La priorité de ton rapport de bug a été mise à jour.',
    outro: 'Merci pour ton rapport. Nous continuerons à te tenir au courant de toute évolution.',
  }),
};

export default fr;
