import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles, BRAND_COLOR_PLACEHOLDER } from '../styles.js';

export const newReport: TeamTemplateDefaults = {
  en: {
    subject: '[{{project.name}}] New Bug Report: {{report.title}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">New {{app.name}} Report</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{project.name}}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">{{report.title}}</h2>
      <p>{{report.description}}</p>

      <div class="meta">
        <div class="meta-row">
          <span class="label">Status:</span>
          <span class="badge badge-status">{{report.statusFormatted}}</span>
        </div>
        <div class="meta-row">
          <span class="label">Priority:</span>
          <span class="badge badge-priority">{{report.priorityFormatted}}</span>
        </div>
        <div class="meta-row">
          <span class="label">URL:</span>
          <span style="color: ${BRAND_COLOR_PLACEHOLDER}; word-break: break-all;">{{report.pageUrl}}</span>
        </div>
        <div class="meta-row">
          <span class="label">Reported:</span>
          <span>{{report.createdAt}}</span>
        </div>
      </div>

      <a href="{{report.url}}" class="button" style="color: white;">View Report</a>
    </div>
  </div>
</body>
</html>`,
  },
};
