import type { TeamTemplateDefaults } from '@shared/types';
import { emailStyles } from '../styles.js';

export const invitation: TeamTemplateDefaults = {
  en: {
    subject: "You've been invited to {{app.name}}",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${emailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">You're Invited!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">{{app.name}}</p>
    </div>
    <div class="content">
      <p style="font-size: 16px;">
        <strong>{{inviter.name}}</strong> has invited you to join {{app.name}} as a team member.
      </p>
      <p style="font-size: 16px;">
        Click the button below to accept the invitation and set up your account:
      </p>
      <div style="text-align: center;">
        <a href="{{invite.url}}" class="button" style="padding: 14px 28px; font-weight: 600; color: white;">Accept Invitation</a>
      </div>
      <p style="font-size: 14px; color: #6b7280;">
        This invitation will expire in {{invite.expiresInDays}} days.
      </p>
      <p style="font-size: 14px; color: #6b7280;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`,
  },
};
