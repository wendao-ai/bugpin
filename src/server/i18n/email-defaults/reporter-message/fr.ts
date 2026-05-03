import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const fr: EmailTemplate = {
  subject: 'Message concernant ton rapport de bug : {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Message concernant ton rapport',
    intro:
      "<strong>{{sender.name}}</strong> t'a envoyé un message concernant ton rapport de bug.",
  }),
};

export default fr;
