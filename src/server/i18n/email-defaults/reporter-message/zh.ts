import type { EmailTemplate } from '@shared/types';
import { reporterMessageHtml } from '../styles.js';

const zh: EmailTemplate = {
  subject: '关于您 bug 报告的留言：{{report.title}}',
  html: reporterMessageHtml({
    headerTitle: '关于您报告的留言',
    intro: '<strong>{{sender.name}}</strong> 就您的 bug 报告向您发来一条留言。',
  }),
};

export default zh;
