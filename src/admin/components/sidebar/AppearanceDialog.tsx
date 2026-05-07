import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Sun, Moon, Monitor } from 'lucide-react';

interface AppearanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppearanceDialog({ open, onOpenChange }: AppearanceDialogProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('appearance.appearance')}</DialogTitle>
          <DialogDescription>{t('appearance.customizeAppearance')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('appearance.theme')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="appearance-theme-btn flex-1"
              >
                <Sun />
                {t('appearance.light')}
              </Button>
              <Button
                type="button"
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="appearance-theme-btn flex-1"
              >
                <Moon />
                {t('appearance.dark')}
              </Button>
              <Button
                type="button"
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="appearance-theme-btn flex-1"
              >
                <Monitor />
                {t('appearance.system')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('appearance.customizeAppearance')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
