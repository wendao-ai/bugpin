import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from './ui/sidebar';
import { Separator } from './ui/separator';
import { AppSidebar } from './sidebar/AppSidebar';
import { Footer } from './Footer';
import { UpdateBanner } from './UpdateBanner';

// Map hash to sub-tab label (for breadcrumb display)
const hashToLabel: Record<string, string> = {
  system: 'settings.system',
  screenshot: 'settings.screenshot',
  storage: 'settings.storage',
  design: 'settings.design',
  widgetDialog: 'settings.widgetDialog',
  widgetLauncherButton: 'settings.widgetButton',
  notifications: 'settings.notificationsTab',
  reporterNotifications: 'settings.reporter',
  smtp: 'settings.smtp',
  emailTemplates: 'settings.emailTemplates',
  security: 'settings.rateLimits',
  users: 'settings.users',
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isSettingsPage = location.pathname.startsWith('/globalsettings');
  const [activeTabLabel, setActiveTabLabel] = useState('settings.system');

  // Track hash changes for Settings breadcrumb
  useEffect(() => {
    const updateTab = () => {
      const hash = window.location.hash.slice(1);
      if (hash && hashToLabel[hash]) {
        setActiveTabLabel(hashToLabel[hash]);
      } else {
        setActiveTabLabel('settings.system');
      }
    };

    updateTab();
    window.addEventListener('hashchange', updateTab);
    return () => window.removeEventListener('hashchange', updateTab);
  }, []);

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return t('layout.dashboard');
    if (path.startsWith('/reports')) return t('layout.reports');
    if (path.startsWith('/projects')) return t('layout.projects');
    if (path.startsWith('/globalsettings')) return t('layout.settings');
    return t('app.bugpin');
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-screen max-w-[100vw] min-w-0">
        <UpdateBanner />
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />

          {isSettingsPage ? (
            <nav className="flex items-center gap-1 text-sm">
              <button
                onClick={() => {
                  navigate('/globalsettings');
                  window.location.hash = '#system';
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('layout.settings')}
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{t(activeTabLabel)}</span>
            </nav>
          ) : (
            <h1 className="text-sm font-medium">{getPageTitle()}</h1>
          )}
        </header>
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col gap-4 p-4 md:p-6">
            <Outlet />
          </div>
        </div>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  );
}
