import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles, BRAND_COLOR_PLACEHOLDER } from '../styles.js';

export const testEmail: TeamTemplateDefaults = {
  en: {
    subject: 'Test Email from {{app.name}}',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${emailStyles}
    .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">Test Email</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{app.name}}</p>
    </div>
    <div class="content" style="border-radius: 0;">
      <div class="success-icon">&#x2709;&#xFE0F;</div>
      <h2 style="text-align: center; color: ${BRAND_COLOR_PLACEHOLDER};">SMTP Configuration Successful!</h2>
      <p style="text-align: center; color: #6b7280;">
        Your email server is configured correctly and able to send emails.
        You can now receive notifications for bug reports.
      </p>
      <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af;">
        This is a test email sent from {{app.name}} to verify your SMTP settings.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
};
