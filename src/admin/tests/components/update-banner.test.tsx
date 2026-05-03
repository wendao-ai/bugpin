import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent, waitFor } from '../utils';
import { UpdateBanner } from '../../components/UpdateBanner';
import { server } from '../mocks/server';
import { mockUsers } from '../mocks/handlers';

const RELEASE_URL = 'https://github.com/aranticlabs/bugpin/releases/tag/v1.0.7';

const STORAGE_KEY = 'bugpin.updateBanner.dismissedVersion';

interface VersionResponseBody {
  current?: string;
  latest?: string | null;
  updateAvailable?: boolean;
  releaseUrl?: string | null;
  publishedAt?: string | null;
  lastCheckedAt?: string | null;
  checkEnabled?: boolean;
}

function mockVersion(overrides: VersionResponseBody = {}) {
  server.use(
    http.get('/api/version', () =>
      HttpResponse.json({
        success: true,
        current: '1.0.6',
        latest: '1.0.7',
        updateAvailable: true,
        releaseUrl: RELEASE_URL,
        publishedAt: '2026-04-22T10:14:00Z',
        lastCheckedAt: '2026-05-01T08:00:00Z',
        checkEnabled: true,
        ...overrides,
      })
    )
  );
}

function mockUserRole(role: 'admin' | 'editor' | 'viewer') {
  const user =
    role === 'admin' ? mockUsers.admin : role === 'editor' ? mockUsers.editor : mockUsers.viewer;
  server.use(
    http.get('/api/auth/me', () => HttpResponse.json({ success: true, authenticated: true, user }))
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('UpdateBanner', () => {
  it('renders for admins when an update is available', async () => {
    mockUserRole('admin');
    mockVersion();

    renderWithProviders(<UpdateBanner />);

    expect(await screen.findByText(/A new version of BugPin is available/i)).toBeInTheDocument();
    expect(screen.getByText('v1.0.7')).toBeInTheDocument();
  });

  it('opens the release page in a new tab', async () => {
    mockUserRole('admin');
    mockVersion();

    renderWithProviders(<UpdateBanner />);

    const link = await screen.findByRole('link', { name: /View release notes/i });
    expect(link).toHaveAttribute('href', RELEASE_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders nothing for viewers', async () => {
    mockUserRole('viewer');
    mockVersion();

    const { container } = renderWithProviders(<UpdateBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing for editors', async () => {
    mockUserRole('editor');
    mockVersion();

    const { container } = renderWithProviders(<UpdateBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when updateAvailable is false', async () => {
    mockUserRole('admin');
    mockVersion({ updateAvailable: false });

    const { container } = renderWithProviders(<UpdateBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders nothing when checkEnabled is false', async () => {
    mockUserRole('admin');
    mockVersion({ checkEnabled: false, updateAvailable: false, latest: null });

    const { container } = renderWithProviders(<UpdateBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('hides the banner and stores the dismissed version in localStorage', async () => {
    mockUserRole('admin');
    mockVersion();

    const user = userEvent.setup();
    renderWithProviders(<UpdateBanner />);

    const dismiss = await screen.findByRole('button', { name: /Dismiss/i });
    await user.click(dismiss);

    await waitFor(() => {
      expect(screen.queryByText(/A new version of BugPin is available/i)).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1.0.7');
  });

  it('reappears when a newer version is published after dismissal', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1.0.7');
    mockUserRole('admin');
    mockVersion({ latest: '1.0.8', releaseUrl: RELEASE_URL.replace('1.0.7', '1.0.8') });

    renderWithProviders(<UpdateBanner />);

    expect(await screen.findByText('v1.0.8')).toBeInTheDocument();
  });

  it('stays hidden when the stored dismissal matches the current latest', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1.0.7');
    mockUserRole('admin');
    mockVersion();

    const { container } = renderWithProviders(<UpdateBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
