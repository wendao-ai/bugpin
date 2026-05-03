import type { EmailTemplate } from '@shared/types';
import { reporterStatusChangeHtml } from '../styles.js';

const zh: EmailTemplate = {
  subject: '您的 bug 报告状态更新：{{report.title}}',
  html: reporterStatusChangeHtml({
    headerTitle: '报告状态已更新',
    intro: '您的 bug 报告状态已更新。',
    teamMessageLabel: '团队留言：',
    outro: '感谢您的反馈。我们会持续向您通报后续进展。',
  }),
};

export default zh;
