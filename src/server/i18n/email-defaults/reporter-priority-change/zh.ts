import type { EmailTemplate } from '@shared/types';
import { reporterPriorityChangeHtml } from '../styles.js';

const zh: EmailTemplate = {
  subject: '您的 bug 报告优先级已更新：{{report.title}}',
  html: reporterPriorityChangeHtml({
    headerTitle: '报告优先级已更新',
    intro: '您的 bug 报告优先级已更新。',
    outro: '感谢您的反馈。我们会持续向您通报后续进展。',
  }),
};

export default zh;
