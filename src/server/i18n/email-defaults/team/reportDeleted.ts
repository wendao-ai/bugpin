import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles } from '../styles.js';

export const reportDeleted: TeamTemplateDefaults = {
  en: {
    subject: '[{{project.name}}] Report Deleted: {{report.title}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Report Deleted</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{project.name}}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">{{report.title}}</h2>
      <p style="color: #4b5563;">A report in <strong>{{project.name}}</strong> has been permanently deleted. The report and all associated data are no longer available. Below is a summary of the report at the time of deletion.</p>

      <div class="meta">
        <div class="meta-row">
          <span class="label">Status:</span>
          <span class="badge badge-status">{{report.statusFormatted}}</span>
        </div>
        <div class="meta-row">
          <span class="label">Priority:</span>
          <span class="badge badge-priority">{{report.priorityFormatted}}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
};
