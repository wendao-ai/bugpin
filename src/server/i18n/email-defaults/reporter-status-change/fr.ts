import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const fr: EmailTemplate = {
  subject: 'Mise à jour de ton rapport de bug : {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Statut du rapport mis à jour',
    intro: 'Le statut de ton rapport de bug a été mis à jour.',
    teamMessageLabel: "Message de l'équipe :",
    outro: 'Merci pour ton rapport. Nous continuerons à te tenir au courant de toute évolution.',
  }),
};

export default fr;
