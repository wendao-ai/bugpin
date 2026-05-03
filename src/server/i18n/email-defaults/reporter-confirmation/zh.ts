import type { EmailTemplate } from '@shared/types';
import { reporterConfirmationHtml } from '../styles.js';

const zh: EmailTemplate = {
  subject: '您的 bug 报告已收到：{{report.title}}',
  html: reporterConfirmationHtml({
    headerTitle: '报告已收到',
    intro: '感谢您提交 bug 报告。我们的团队已收到您的报告，并将尽快进行处理。',
    labelStatus: '状态：',
    labelPriority: '优先级：',
    labelSubmitted: '提交时间：',
    outro: '当您报告的状态发生变化时，您将收到邮件通知。',
  }),
};

export default zh;
