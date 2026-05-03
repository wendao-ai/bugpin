import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const de: EmailTemplate = {
  subject: 'Prioritätsänderung deines Fehlerberichts: {{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: 'Priorität des Berichts aktualisiert',
    intro: 'Die Priorität deines Fehlerberichts wurde aktualisiert.',
    outro:
      'Vielen Dank für deinen Bericht. Wir halten dich weiterhin über alle Änderungen auf dem Laufenden.',
  }),
};

export default de;
