import nodemailer from 'nodemailer';
import { settingsCacheService } from './settings-cache.service.js';
import { logger } from '../utils/logger.js';
import { templateService } from './template.service.js';
import {
  defaultEmailTemplates,
  appendFooterToHtml,
  applyBrandColor,
  DEFAULT_BRAND_COLOR,
} from '../constants/email-templates.js';
import { getEEHooks } from '../utils/ee-hooks.js';
import type { Report, EmailTemplateType } from '@shared/types';

// Types

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[];
  subject: string;
  html: string;
  text?: string;
}

export interface ReportEmailData {
  report: Report;
  projectName: string;
  reportUrl: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

// Service

export const emailService = {
  createTransporter(config: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  }) {
    return nodemailer.createTransport(config);
  },

  /**
   * Send an email using configured SMTP settings
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      // Load SMTP settings
      const settings = await settingsCacheService.getAll();

      logger.debug('sendEmail called', {
        recipientCount: options.to.length,
        recipients: options.to.map((r) => r.email),
        subject: options.subject,
        smtpEnabled: settings.smtpEnabled,
        smtpHost: settings.smtpConfig.host || '(not set)',
        smtpFrom: settings.smtpConfig.from || '(not set)',
      });

      if (!settings.smtpEnabled) {
        logger.info('SMTP disabled, skipping email send');
        return { success: false, error: 'SMTP is disabled' };
      }

      if (!settings.smtpConfig.host || !settings.smtpConfig.from) {
        logger.warn('SMTP not configured properly');
        return {
          success: false,
          error: 'SMTP not configured properly. Please configure host and from address.',
        };
      }

      const transporter = this.createTransporter({
        host: sanitizeSmtpHost(settings.smtpConfig.host),
        port: settings.smtpConfig.port || 587,
        secure: settings.smtpConfig.port === 465,
        auth: settings.smtpConfig.user
          ? {
              user: settings.smtpConfig.user,
              pass: settings.smtpConfig.password || '',
            }
          : undefined,
      });

      // Send individual emails per recipient in batches to avoid overwhelming the SMTP server
      const fromAddress = `"${settings.appName}" <${settings.smtpConfig.from}>`;
      const batchSize = 10;

      for (let i = 0; i < options.to.length; i += batchSize) {
        const batch = options.to.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((recipient) =>
            transporter.sendMail({
              from: fromAddress,
              to: recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email,
              subject: options.subject,
              html: options.html,
              text: options.text,
            }),
          ),
        );

        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'rejected') {
            logger.warn('Failed to send email to recipient', {
              email: batch[j].email,
              error: (results[j] as PromiseRejectedResult).reason,
            });
          }
        }
      }

      logger.info('Email sent successfully', {
        to: options.to.map((r) => r.email),
        subject: options.subject,
      });

      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as Record<string, unknown>).message)
            : String(error);
      logger.error('Failed to send email', undefined, { error: message });
      return { success: false, error: message };
    }
  },

  /**
   * Get template for a specific type, using custom (via EE hooks) or default
   */
  async getTemplate(templateType: EmailTemplateType): Promise<{ subject: string; html: string }> {
    // Try to get custom template from EE (if licensed)
    const customTemplate = await getEEHooks().getCustomEmailTemplate(templateType);

    if (customTemplate) {
      return customTemplate;
    }

    return defaultEmailTemplates[templateType];
  },

  /**
   * Send notification email for new report
   */
  async sendNewReportNotification(
    recipients: EmailRecipient[],
    data: ReportEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, reportUrl } = data;

    const template = await this.getTemplate('newReport');
    const templateData = {
      app: {
        name: settings.appName || 'BugPin',
        url: settings.appUrl || '',
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
        priority: report.priority,
        priorityFormatted: formatPriority(report.priority),
        url: reportUrl,
        pageUrl: report.metadata?.url || '',
        createdAt: new Date(report.createdAt).toLocaleString(),
      },
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'newReport');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  },

  /**
   * Send notification email for report status change
   */
  async sendStatusChangeNotification(
    recipients: EmailRecipient[],
    data: ReportEmailData & { oldStatus: string; newStatus: string },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, reportUrl, oldStatus, newStatus } = data;

    const template = await this.getTemplate('statusChange');
    const templateData = {
      app: {
        name: settings.appName || 'BugPin',
        url: settings.appUrl || '',
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        url: reportUrl,
      },
      oldStatus,
      oldStatusFormatted: formatStatus(oldStatus),
      newStatus,
      newStatusFormatted: formatStatus(newStatus),
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'statusChange');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  },

  /**
   * Send notification email for report priority change
   */
  async sendPriorityChangeNotification(
    recipients: EmailRecipient[],
    data: ReportEmailData & { oldPriority: string; newPriority: string },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, reportUrl, oldPriority, newPriority } = data;

    const template = await this.getTemplate('priorityChange');
    const templateData = {
      app: {
        name: settings.appName || 'BugPin',
        url: settings.appUrl || '',
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        url: reportUrl,
      },
      oldPriority,
      oldPriorityFormatted: formatPriority(oldPriority),
      newPriority,
      newPriorityFormatted: formatPriority(newPriority),
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'priorityChange');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  },

  /**
   * Send notification email for report deletion
   */
  async sendReportDeletedNotification(
    recipients: EmailRecipient[],
    data: ReportEmailData,
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName } = data;

    const template = await this.getTemplate('reportDeleted');
    const templateData = {
      app: {
        name: settings.appName || 'BugPin',
        url: settings.appUrl || '',
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
        priority: report.priority,
        priorityFormatted: formatPriority(report.priority),
      },
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reportDeleted');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  },

  /**
   * Send notification email for report assignment
   */
  async sendAssignmentNotification(
    recipients: EmailRecipient[],
    data: ReportEmailData & { assignedToName: string; assignedToEmail?: string },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, reportUrl, assignedToName, assignedToEmail } = data;

    const template = await this.getTemplate('assignment');
    const templateData = {
      app: {
        name: settings.appName || 'BugPin',
        url: settings.appUrl || '',
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        url: reportUrl,
      },
      assignee: {
        name: assignedToName,
        email: assignedToEmail || '',
      },
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'assignment');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  },

  /**
   * Send confirmation email to reporter after submitting a report
   */
  async sendReporterConfirmationEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl } = data;

    const template = await this.getTemplate('reporterConfirmation');
    const templateData = {
      app: {
        name: appName,
        url: appUrl,
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
        priority: report.priority,
        priorityFormatted: formatPriority(report.priority),
        createdAt: new Date(report.createdAt).toLocaleString(),
      },
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reporterConfirmation');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send status change email to reporter
   */
  async sendReporterStatusChangeEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
      oldStatus: string;
      newStatus: string;
      reporterMessage?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl, oldStatus, newStatus, reporterMessage } = data;

    const template = await this.getTemplate('reporterStatusChange');
    const templateData = {
      app: {
        name: appName,
        url: appUrl,
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
      },
      oldStatus,
      oldStatusFormatted: formatStatus(oldStatus),
      newStatus,
      newStatusFormatted: formatStatus(newStatus),
      reporterMessage: reporterMessage || '',
      reporterMessageDisplay: reporterMessage ? 'block' : 'none',
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reporterStatusChange');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send priority change email to reporter
   */
  async sendReporterPriorityChangeEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
      oldPriority: string;
      newPriority: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl, oldPriority, newPriority } = data;

    const template = await this.getTemplate('reporterPriorityChange');
    const templateData = {
      app: {
        name: appName,
        url: appUrl,
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        priority: report.priority,
        priorityFormatted: formatPriority(report.priority),
      },
      oldPriority,
      oldPriorityFormatted: formatPriority(oldPriority),
      newPriority,
      newPriorityFormatted: formatPriority(newPriority),
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reporterPriorityChange');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send assignment change email to reporter
   */
  async sendReporterAssignmentEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
      assigneeName: string;
      previousAssigneeName?: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl, assigneeName, previousAssigneeName } = data;

    const subject = `[${projectName}] Report Assignment Updated: ${report.title}`;
    const intro = previousAssigneeName
      ? `Your report has been reassigned from <strong>${previousAssigneeName}</strong> to <strong>${assigneeName}</strong>.`
      : `Your report has been assigned to <strong>${assigneeName}</strong>.`;
    const reportLink = appUrl ? `<p><a href="${appUrl}/admin/reports/${report.id}">View report</a></p>` : '';
    const html = applyBrandColor(
      `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Assignment Updated</h1>
          <p>${intro}</p>
          <div style="margin: 24px 0; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <p style="margin: 0 0 8px;"><strong>Project:</strong> ${projectName}</p>
            <p style="margin: 0 0 8px;"><strong>Report:</strong> ${report.title}</p>
            <p style="margin: 0;"><strong>Status:</strong> ${formatStatus(report.status)}</p>
          </div>
          ${reportLink}
          <p style="color: #6b7280;">Sent by ${appName}.</p>
        </div>
      `,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send a direct message email to the reporter
   */
  async sendReporterMessageEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
      senderName: string;
      message: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl, senderName, message } = data;

    const template = await this.getTemplate('reporterMessage');
    const templateData = {
      app: {
        name: appName,
        url: appUrl,
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
      },
      sender: {
        name: senderName,
      },
      message,
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reporterMessage');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send a CC copy of a reporter message to the sender
   */
  async sendReporterMessageCcEmail(
    recipient: string,
    data: {
      report: Report;
      projectName: string;
      appName: string;
      appUrl: string;
      senderName: string;
      message: string;
    },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const { report, projectName, appName, appUrl, senderName, message } = data;

    const template = await this.getTemplate('reporterMessage');
    const templateData = {
      app: {
        name: appName,
        url: appUrl,
      },
      project: {
        name: projectName,
      },
      report: {
        title: report.title,
        description: report.description || '',
        status: report.status,
        statusFormatted: formatStatus(report.status),
      },
      sender: {
        name: senderName,
      },
      message,
    };

    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'reporterMessage');
    const html = applyBrandColor(
      withFooter,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    const subject = `[CC] Message sent to reporter — ${report.title}`;

    return this.sendEmail({
      to: [{ email: recipient }],
      subject,
      html,
    });
  },

  /**
   * Send invitation email to a new user
   */
  async sendInvitationEmail(
    recipient: EmailRecipient,
    data: { inviteUrl: string; inviterName: string; expiresInDays: number },
  ): Promise<{ success: boolean; error?: string }> {
    const settings = await settingsCacheService.getAll();
    const appName = settings.appName || 'BugPin';

    const template = await this.getTemplate('invitation');
    const templateData = {
      app: {
        name: appName,
      },
      inviter: {
        name: data.inviterName,
      },
      invite: {
        url: data.inviteUrl,
        expiresInDays: data.expiresInDays,
      },
    };

    const subject = templateService.compileTemplate(template.subject, templateData);
    const compiledHtml = templateService.compileTemplate(template.html, templateData);
    const withFooter = appendFooterToHtml(compiledHtml, 'invitation');
    const withFooterCompiled = templateService.compileTemplate(withFooter, templateData);
    const html = applyBrandColor(
      withFooterCompiled,
      settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
    );

    return this.sendEmail({
      to: [recipient],
      subject,
      html,
    });
  },

  /**
   * Send a test email to verify SMTP configuration
   */
  async sendTestEmail(
    config: SMTPConfig,
    recipientEmail: string,
    appName: string = 'BugPin',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!config.host || !config.from) {
        return { success: false, error: 'SMTP host and from address are required' };
      }

      const transporter = this.createTransporter({
        host: sanitizeSmtpHost(config.host),
        port: config.port || 587,
        secure: config.port === 465,
        auth: config.user
          ? {
              user: config.user,
              pass: config.password || '',
            }
          : undefined,
      });

      // Verify connection
      await transporter.verify();

      // Get template and compile
      const settings = await settingsCacheService.getAll();
      const template = await this.getTemplate('testEmail');
      const templateData = {
        app: {
          name: appName,
        },
      };

      const subject = templateService.compileTemplate(template.subject, templateData);
      const compiledHtml = templateService.compileTemplate(template.html, templateData);
      const withFooter = appendFooterToHtml(compiledHtml, 'testEmail');
      const html = applyBrandColor(
        withFooter,
        settings.branding?.primaryColor || DEFAULT_BRAND_COLOR,
      );

      // Send test email
      await transporter.sendMail({
        from: `"${appName}" <${config.from}>`,
        to: recipientEmail,
        subject,
        html,
        text: `This is a test email from ${appName} to verify your SMTP configuration is working correctly.`,
      });

      logger.info('Test email sent successfully', { to: recipientEmail });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as Record<string, unknown>).message)
            : String(error);
      logger.error('Failed to send test email', undefined, { error: message });
      return { success: false, error: message };
    }
  },
};

// Helper Functions

function sanitizeSmtpHost(host: string): string {
  return host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] || status;
}

function formatPriority(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
