import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const de: EmailTemplate = {
  subject: 'Nachricht zu deinem Fehlerbericht: {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Nachricht zu deinem Bericht',
    intro:
      '<strong>{{sender.name}}</strong> hat dir eine Nachricht zu deinem Fehlerbericht gesendet.',
  }),
};

export default de;
