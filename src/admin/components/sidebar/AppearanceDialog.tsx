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
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>Customize how BugPin looks on your device</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
                className="appearance-theme-btn flex-1"
              >
                <Sun />
                Light
              </Button>
              <Button
                type="button"
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
                className="appearance-theme-btn flex-1"
              >
                <Moon />
                Dark
              </Button>
              <Button
                type="button"
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
                className="appearance-theme-btn flex-1"
              >
                <Monitor />
                System
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Select your preferred theme or use your system settings
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
