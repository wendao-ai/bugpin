import { config } from '../config.js';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import { Result } from '../utils/result.js';
import { logger } from '../utils/logger.js';
import { isNewer } from '../utils/version-compare.js';

const TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const RELEASES_URL = 'https://api.github.com/repos/aranticlabs/bugpin/releases/latest';
const CACHE_KEY = 'update_check_cache';
const SETTING_KEY = 'update_check_enabled';

export interface UpdateCheckCache {
  latest: string | null;
  tagName: string | null;
  releaseUrl: string | null;
  publishedAt: string | null;
  checkedAt: string | null;
  nextAttemptAt: string;
  lastError: string | null;
}

export interface UpdateCheckStatus {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  publishedAt: string | null;
  lastCheckedAt: string | null;
  checkEnabled: boolean;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
}

interface ParsedRelease {
  tagName: string;
  latest: string;
  releaseUrl: string;
  publishedAt: string;
}

function isShape<T>(
  value: unknown,
  predicate: (v: Record<string, unknown>) => boolean
): value is T {
  return typeof value === 'object' && value !== null && predicate(value as Record<string, unknown>);
}

function parseCache(raw: unknown): UpdateCheckCache | null {
  if (!isShape<UpdateCheckCache>(raw, (v) => typeof v.nextAttemptAt === 'string')) {
    return null;
  }
  return {
    latest: typeof raw.latest === 'string' ? raw.latest : null,
    tagName: typeof raw.tagName === 'string' ? raw.tagName : null,
    releaseUrl: typeof raw.releaseUrl === 'string' ? raw.releaseUrl : null,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    checkedAt: typeof raw.checkedAt === 'string' ? raw.checkedAt : null,
    nextAttemptAt: raw.nextAttemptAt,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
  };
}

async function loadCache(): Promise<UpdateCheckCache | null> {
  const raw = await settingsRepo.get<unknown>(CACHE_KEY);
  if (raw === null || raw === undefined) {
    return null;
  }
  return parseCache(raw);
}

async function writeCache(entry: UpdateCheckCache): Promise<void> {
  await settingsRepo.set(CACHE_KEY, entry);
}

function buildStatus(cache: UpdateCheckCache | null, checkEnabled: boolean): UpdateCheckStatus {
  const latest = cache?.latest ?? null;
  const updateAvailable = checkEnabled && latest !== null && isNewer(latest, config.version);
  return {
    current: config.version,
    latest,
    updateAvailable,
    releaseUrl: cache?.releaseUrl ?? null,
    publishedAt: cache?.publishedAt ?? null,
    lastCheckedAt: cache?.checkedAt ?? null,
    checkEnabled,
  };
}

async function fetchLatest(): Promise<ParsedRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(RELEASES_URL, {
      method: 'GET',
      headers: {
        'User-Agent': `BugPin/${config.version}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub responded with status ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    if (
      !isShape<GitHubRelease>(
        body,
        (v) =>
          typeof v.tag_name === 'string' &&
          typeof v.html_url === 'string' &&
          typeof v.published_at === 'string' &&
          typeof v.prerelease === 'boolean' &&
          typeof v.draft === 'boolean'
      )
    ) {
      throw new Error('Unexpected GitHub release payload shape');
    }

    if (body.draft || body.prerelease) {
      throw new Error('GitHub returned a draft or prerelease entry');
    }

    const tagName = body.tag_name;
    const latest = tagName.startsWith('v') ? tagName.slice(1) : tagName;

    return {
      tagName,
      latest,
      releaseUrl: body.html_url,
      publishedAt: body.published_at,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Module-scoped dedup state: coalesces concurrent refreshes into one outbound fetch.
let pendingRefresh: Promise<UpdateCheckCache | null> | null = null;

async function refreshCache(previous: UpdateCheckCache | null): Promise<UpdateCheckCache | null> {
  let release: ParsedRelease | null = null;
  let fetchError: string | null = null;

  try {
    release = await fetchLatest();
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
    logger.warn('Update check fetch failed', { error: fetchError });
  }

  const now = new Date();
  const next: UpdateCheckCache =
    release !== null
      ? {
          latest: release.latest,
          tagName: release.tagName,
          releaseUrl: release.releaseUrl,
          publishedAt: release.publishedAt,
          checkedAt: now.toISOString(),
          nextAttemptAt: new Date(now.getTime() + TTL_MS).toISOString(),
          lastError: null,
        }
      : {
          latest: previous?.latest ?? null,
          tagName: previous?.tagName ?? null,
          releaseUrl: previous?.releaseUrl ?? null,
          publishedAt: previous?.publishedAt ?? null,
          checkedAt: previous?.checkedAt ?? null,
          nextAttemptAt: new Date(now.getTime() + FAILURE_COOLDOWN_MS).toISOString(),
          lastError: fetchError,
        };

  await writeCache(next);
  return next;
}

async function refreshOrAwait(previous: UpdateCheckCache | null): Promise<UpdateCheckCache | null> {
  if (pendingRefresh) {
    return pendingRefresh;
  }
  pendingRefresh = refreshCache(previous)
    .then((value) => {
      pendingRefresh = null;
      return value;
    })
    .catch((err) => {
      pendingRefresh = null;
      throw err;
    });
  return pendingRefresh;
}

export const updateCheckService = {
  async getStatus(): Promise<Result<UpdateCheckStatus>> {
    try {
      const enabled = (await settingsRepo.get<boolean>(SETTING_KEY)) ?? true;
      if (!enabled) {
        return Result.ok(buildStatus(null, false));
      }

      const cache = await loadCache();
      const now = Date.now();

      const isWithinTtl =
        cache?.checkedAt !== undefined &&
        cache?.checkedAt !== null &&
        now - new Date(cache.checkedAt).getTime() < TTL_MS;

      const isWithinCooldown =
        cache?.nextAttemptAt !== undefined &&
        cache?.nextAttemptAt !== null &&
        now < new Date(cache.nextAttemptAt).getTime();

      if (isWithinTtl || isWithinCooldown) {
        return Result.ok(buildStatus(cache, true));
      }

      const refreshed = await refreshOrAwait(cache);
      return Result.ok(buildStatus(refreshed, true));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Update check failed unexpectedly', { error: message });
      return Result.fail(message, 'UPDATE_CHECK_ERROR');
    }
  },
};
