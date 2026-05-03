import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const nl: EmailTemplate = {
  subject: 'Bericht over uw bugrapport: {{report.title}}',
  html: reporterMessageHtml({
    headerTitle: 'Bericht over uw rapport',
    intro: '<strong>{{sender.name}}</strong> heeft u een bericht gestuurd over uw bugrapport.',
  }),
};

export default nl;
