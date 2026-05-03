import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const de: EmailTemplate = {
  subject: 'Aktualisierung deines Fehlerberichts: {{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: 'Berichtsstatus aktualisiert',
    intro: 'Der Status deines Fehlerberichts wurde aktualisiert.',
    teamMessageLabel: 'Nachricht vom Team:',
    outro:
      'Vielen Dank für deinen Bericht. Wir halten dich weiterhin über alle Änderungen auf dem Laufenden.',
  }),
};

export default de;
