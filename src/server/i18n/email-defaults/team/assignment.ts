import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles } from '../styles.js';

export const assignment: TeamTemplateDefaults = {
  en: {
    subject: '[{{project.name}}] Report Assigned to You: {{report.title}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Report Assigned to You</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{project.name}}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">{{report.title}}</h2>
      <p style="color: #4b5563;">A report in <strong>{{project.name}}</strong> has been assigned to <strong>{{assignee.name}}</strong>. Please review the details below and take any necessary action.</p>
      <p>{{report.description}}</p>

      <a href="{{report.url}}" class="button" style="color: white;">View Report</a>
    </div>
  </div>
</body>
</html>`,
  },
};
