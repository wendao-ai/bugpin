import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles, BRAND_COLOR_PLACEHOLDER } from '../styles.js';

export const statusChange: TeamTemplateDefaults = {
  en: {
    subject: '[{{project.name}}] Report Status Changed: {{report.title}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles}
    .status-change { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; text-align: center; }
    .arrow { color: #6b7280; margin: 0 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Report Status Updated</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{project.name}}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">{{report.title}}</h2>
      <p style="color: #4b5563;">The status of this report in <strong>{{project.name}}</strong> has been updated.</p>

      <div class="status-change">
        <strong style="color: #6b7280;">{{oldStatusFormatted}}</strong>
        <span class="arrow">&rarr;</span>
        <strong style="color: ${BRAND_COLOR_PLACEHOLDER};">{{newStatusFormatted}}</strong>
      </div>

      <a href="{{report.url}}" class="button" style="color: white;">View Report</a>
    </div>
  </div>
</body>
</html>`,
  },
};
