import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const de: EmailTemplate = {
  subject: 'Dein Fehlerbericht ist eingegangen: {{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: 'Bericht eingegangen',
    intro:
      'Vielen Dank für deinen Fehlerbericht. Unser Team hat ihn erhalten und wird ihn in Kürze prüfen.',
    labelStatus: 'Status:',
    labelPriority: 'Priorität:',
    labelSubmitted: 'Gesendet:',
    outro: 'Du erhältst E-Mail-Benachrichtigungen, sobald sich der Status deines Berichts ändert.',
  }),
};

export default de;
