import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { ExternalLink } from 'lucide-react';

declare const __APP_VERSION__: string;

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}
const GITHUB_URL = 'https://github.com/aranticlabs/bugpin';
const LICENSE_URL = 'https://docs.bugpin.io/legal/license';
const TRADEMARK_URL = 'https://docs.bugpin.io/legal/trademark';

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('about.about')} BugPin</DialogTitle>
          <DialogDescription>{t('about.selfHostedDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('about.version')}</p>
            <p className="text-sm text-muted-foreground">{__APP_VERSION__}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t('about.copyright')}</p>
            <p className="text-sm text-muted-foreground">© {currentYear} Arantic Digital</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t('about.license')}</p>
            <p className="text-sm text-muted-foreground">
              {t('about.licenseDetail')}
            </p>
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
            >
              {t('about.viewLicense')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t('about.sourceCode')}</p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {GITHUB_URL.replace('https://', '')}
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              {t('about.openSourceNote')}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">{t('about.trademark')}</p>
            <p className="text-sm text-muted-foreground">
              {t('about.trademarkDetail')}
            </p>
            <a
              href={TRADEMARK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-1"
            >
              {t('about.viewTrademarkPolicy')}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              This software includes third-party open source components. See the{' '}
              <a
                href={`${GITHUB_URL}/blob/main/NOTICE`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                NOTICE
              </a>{' '}
              file for details.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
