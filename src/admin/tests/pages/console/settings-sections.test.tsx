import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  renderWithProviders,
  renderWithQuery,
  screen,
  userEvent,
  waitFor,
  fireEvent,
} from '../../utils';
import { Settings } from '../../../pages/console/Settings';
import { Screenshot } from '../../../pages/widget/Screenshot';
import { Security } from '../../../pages/console/Security';
import { SMTP } from '../../../pages/console/SMTP';
import { api } from '../../../api/client';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('Settings sections', () => {
  it('submits general settings updates', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } } as unknown);

    renderWithProviders(<Settings />);

    await screen.findByDisplayValue('BugPin');
    const appNameInput = screen.getByLabelText(/application name/i);
    const retentionInput = screen.getByLabelText(/data retention/i);

    await user.clear(appNameInput);
    await user.type(appNameInput, 'New App Name');
    fireEvent.change(retentionInput, { target: { value: '120' } });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({
          appName: 'New App Name',
          retentionDays: 120,
        })
      );
    });
  });

  it('submits the update-check toggle when switched off and back on', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } } as unknown);

    renderWithProviders(<Settings />);

    const updateSwitch = await screen.findByRole('switch', { name: /check for updates/i });
    expect(updateSwitch).toHaveAttribute('aria-checked', 'true');

    await user.click(updateSwitch);
    expect(updateSwitch).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({ updateCheckEnabled: false })
      );
    });

    putSpy.mockClear();

    await user.click(updateSwitch);
    expect(updateSwitch).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({ updateCheckEnabled: true })
      );
    });
  });

  it('submits screenshot settings updates', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } } as unknown);

    renderWithQuery(<Screenshot />);

    await screen.findByLabelText(/max\.? screenshot size/i);

    const screenCaptureSwitch = screen.getByRole('switch', { name: /use screen capture api/i });
    await user.click(screenCaptureSwitch);

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith('/settings', {
        screenshot: {
          maxScreenshotSize: 5,
          maxImageUploadSizeMb: 10,
          maxVideoUploadSizeMb: 50,
          useScreenCaptureAPI: true,
        },
      });
    });
  });

  it('submits security settings updates', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } } as unknown);

    renderWithQuery(<Security />);

    const rateLimitInput = await screen.findByLabelText(/requests per minute/i);
    const sessionInput = screen.getByLabelText(/session duration/i);

    fireEvent.change(rateLimitInput, { target: { value: '120' } });
    fireEvent.change(sessionInput, { target: { value: '14' } });

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({
          rateLimitPerMinute: 120,
          sessionMaxAgeDays: 14,
        })
      );
    });
  });

  it('submits SMTP settings and sends test email', async () => {
    const user = userEvent.setup();
    const putSpy = vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } } as unknown);
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } } as unknown);

    renderWithProviders(<SMTP />);

    const hostInput = await screen.findByLabelText(/smtp host/i);
    const fromInput = screen.getByLabelText(/from email address/i);

    await user.type(hostInput, 'smtp.example.com');
    await user.type(fromInput, 'bugs@example.com');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        '/settings',
        expect.objectContaining({
          smtpEnabled: true,
          smtpConfig: expect.objectContaining({
            host: 'smtp.example.com',
            from: 'bugs@example.com',
          }),
        })
      );
    });

    const testButton = screen.getByRole('button', { name: /send test email/i });
    await user.click(testButton);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        '/settings/test-email',
        expect.objectContaining({
          smtpConfig: expect.objectContaining({
            host: 'smtp.example.com',
            from: 'bugs@example.com',
          }),
          testEmail: expect.stringMatching(/@/),
        })
      );
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
