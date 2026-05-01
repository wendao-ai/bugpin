import { ExternalLink, Sparkles, X } from 'lucide-react';
import { useUpdateCheck } from '../hooks/useUpdateCheck';

export function UpdateBanner() {
  const { isAdmin, checkEnabled, updateAvailable, latest, releaseUrl, isDismissed, dismiss } =
    useUpdateCheck();

  if (!isAdmin || !checkEnabled || !updateAvailable || !latest || isDismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm text-foreground"
    >
      <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="flex-1 min-w-0">
        A new version of BugPin is available — <span className="font-medium">v{latest}</span>.{' '}
        {releaseUrl && (
          <a
            href={releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            View release notes
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss update notification"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-primary/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
