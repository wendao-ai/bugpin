import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const fr: EmailTemplate = {
  subject: 'Ton rapport de bug a bien été reçu : {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Rapport reçu',
    intro:
      "Merci d'avoir envoyé ton rapport de bug. Notre équipe l'a bien reçu et l'examinera sous peu.",
    labelStatus: 'Statut :',
    labelPriority: 'Priorité :',
    labelSubmitted: 'Envoyé le :',
    outro: 'Tu recevras un e-mail dès que le statut de ton rapport évoluera.',
  }),
};

export default fr;
