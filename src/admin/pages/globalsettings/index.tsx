import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { SystemSettings } from './SystemSettings';
import { ScreenshotSettings } from './ScreenshotSettings';
import { SMTPSettings } from './SMTPSettings';
import { EmailTemplatesSettings } from './EmailTemplatesSettings';
import { SecuritySettings } from './SecuritySettings';
import { StorageSettings } from './StorageSettings';
import { WidgetLauncherButtonSettings } from './WidgetLauncherButtonSettings';
import { BrandingSettings } from './BrandingSettings';
import { WidgetDialogSettings } from './WidgetDialogSettings';
import { UsersSettings } from './UsersSettings';
import { LicenseSettings } from './LicenseSettings';
import { NotificationDefaultsSettings } from './NotificationDefaultsSettings';
import { ReporterNotificationSettings } from './ReporterNotificationSettings';

// All valid hash values (includes sub-tabs like 'screenshot')
const ALL_VALID_HASHES = [
  'system',
  'screenshot',
  'widgetLauncherButton',
  'design',
  'widgetDialog',
  'notifications',
  'reporterNotifications',
  'smtp',
  'emailTemplates',
  'security',
  'storage',
  'users',
  'license',
] as const;
type HashValue = (typeof ALL_VALID_HASHES)[number];

// Main navigation tabs (shown in sidebar)
const MAIN_TABS = ['system', 'design', 'notifications', 'security', 'users', 'license'] as const;
type MainTabValue = (typeof MAIN_TABS)[number];

// Map hash to main tab (for sub-tabs that belong to a parent)
const hashToMainTab: Record<HashValue, MainTabValue> = {
  system: 'system',
  screenshot: 'system', // screenshot is a sub-tab of system
  storage: 'system', // storage is a sub-tab of system
  design: 'design',
  widgetDialog: 'design', // widget dialog is a sub-tab of design
  widgetLauncherButton: 'design', // widget launcher button is a sub-tab of design
  notifications: 'notifications',
  reporterNotifications: 'notifications',
  smtp: 'notifications',
  emailTemplates: 'notifications',
  security: 'security',
  users: 'users',
  license: 'license',
};

interface SubTab {
  hash: HashValue;
  label: string;
}

// Sub-tabs for each main settings page
function useTabConfigs(t: ReturnType<typeof useTranslation>['t']): Record<MainTabValue, SubTab[]> {
  return {
    system: [
      { hash: 'system', label: t('settings.system') },
      { hash: 'screenshot', label: t('settings.screenshot') },
      { hash: 'storage', label: t('settings.storage') },
    ],
    design: [
      { hash: 'widgetLauncherButton', label: t('settings.widgetButton') },
      { hash: 'widgetDialog', label: t('settings.widgetDialog') },
      { hash: 'design', label: t('settings.design') },
    ],
    notifications: [
      { hash: 'notifications', label: t('settings.notificationsTab') },
      { hash: 'reporterNotifications', label: t('settings.reporter') },
      { hash: 'smtp', label: t('settings.smtp') },
      { hash: 'emailTemplates', label: t('settings.emailTemplates') },
    ],
    security: [{ hash: 'security', label: t('settings.rateLimits') }],
    users: [{ hash: 'users', label: t('settings.users') }],
    license: [{ hash: 'license', label: t('settings.license') }],
  };
}

interface SubPageTabsProps {
  mainTab: MainTabValue;
  activeHash: HashValue;
  children: React.ReactNode | React.ReactNode[];
}

function SubPageTabs({ mainTab, activeHash, children }: SubPageTabsProps) {
  const { t } = useTranslation();
  const subTabs = useTabConfigs(t)[mainTab];
  const childArray = Array.isArray(children) ? children : [children];

  // Find the active sub-tab based on current hash
  const activeSubTab = subTabs.find((st) => st.hash === activeHash)?.hash || subTabs[0].hash;

  const handleSubTabChange = (value: string) => {
    window.location.hash = value;
  };

  // Hide tab bar for single-tab sections
  if (subTabs.length === 1) {
    return <>{childArray[0]}</>;
  }

  return (
    <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
      <TabsList>
        {subTabs.map((subTab) => (
          <TabsTrigger key={subTab.hash} value={subTab.hash}>
            {subTab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {subTabs.map((subTab, index) => (
        <TabsContent key={subTab.hash} value={subTab.hash} className="mt-6">
          {childArray[index]}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function Settings() {
  // Get initial hash from URL or default to 'system'
  const getInitialHash = (): HashValue => {
    const hash = window.location.hash.slice(1);
    if (ALL_VALID_HASHES.includes(hash as HashValue)) {
      return hash as HashValue;
    }
    return 'system';
  };

  const [activeHash, setActiveHash] = useState<HashValue>(getInitialHash);

  // Derive main tab from hash
  const activeMainTab = hashToMainTab[activeHash];

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (ALL_VALID_HASHES.includes(hash as HashValue)) {
        setActiveHash(hash as HashValue);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Hidden outer tabs - controlled by activeMainTab derived from hash
  return (
    <Tabs value={activeMainTab}>
      <TabsContent value="system" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="system" activeHash={activeHash}>
          <SystemSettings />
          <ScreenshotSettings />
          <StorageSettings />
        </SubPageTabs>
      </TabsContent>

      <TabsContent value="design" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="design" activeHash={activeHash}>
          <WidgetLauncherButtonSettings />
          <WidgetDialogSettings />
          <BrandingSettings />
        </SubPageTabs>
      </TabsContent>

      <TabsContent value="notifications" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="notifications" activeHash={activeHash}>
          <NotificationDefaultsSettings />
          <ReporterNotificationSettings />
          <SMTPSettings />
          <EmailTemplatesSettings />
        </SubPageTabs>
      </TabsContent>

      <TabsContent value="security" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="security" activeHash={activeHash}>
          <SecuritySettings />
        </SubPageTabs>
      </TabsContent>

      <TabsContent value="users" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="users" activeHash={activeHash}>
          <UsersSettings />
        </SubPageTabs>
      </TabsContent>

      <TabsContent value="license" className="max-w-4xl mt-0">
        <SubPageTabs mainTab="license" activeHash={activeHash}>
          <LicenseSettings />
        </SubPageTabs>
      </TabsContent>
    </Tabs>
  );
}
