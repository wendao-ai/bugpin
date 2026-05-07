import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  type LucideIcon,
  LayoutDashboard,
  ClipboardList,
  FolderKanban,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '../ui/sidebar';

interface NavSubItem {
  title: string;
  url: string;
}

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles?: Array<'admin' | 'editor' | 'viewer'>;
  items?: NavSubItem[];
}

// Navigation items are built dynamically using translations
function useNavItems(): NavItem[] {
  const { t } = useTranslation();
  return [
    {
      title: t('layout.dashboard'),
      url: '/',
      icon: LayoutDashboard,
    },
    {
      title: t('layout.reports'),
      url: '/reports',
      icon: ClipboardList,
    },
    {
      title: t('layout.projects'),
      url: '/projects',
      icon: FolderKanban,
      roles: ['admin'],
    },
    {
      title: t('layout.settings'),
      url: '/globalsettings',
      icon: Settings,
      roles: ['admin'],
      items: [
        { title: t('settings.system'), url: '#system' },
        { title: t('settings.design'), url: '#widgetLauncherButton' },
        { title: t('settings.notificationsTab'), url: '#notifications' },
        { title: t('settings.rateLimits'), url: '#security' },
        { title: t('settings.users'), url: '#users' },
        { title: t('settings.license'), url: '#license' },
      ],
    },
  ];
}

export function NavMain() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const { t } = useTranslation();
  const navItems = useNavItems();

  const closeSidebarOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const filteredItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('common.navigation')}</SidebarGroupLabel>
      <SidebarMenu>
        {filteredItems.map((item) => {
          const isActive =
            item.url === '/' ? location.pathname === '/' : location.pathname.startsWith(item.url);

          // If item has sub-items, render with collapsible
          if (item.items?.length) {
            return (
              <Collapsible key={item.url} asChild defaultOpen={isActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => {
                        const subIsActive =
                          location.hash === subItem.url ||
                          (subItem.url === '#system' &&
                            !location.hash &&
                            location.pathname === item.url);

                        const handleSubItemClick = (e: React.MouseEvent) => {
                          e.preventDefault();
                          // If already on the parent page, just update hash
                          if (
                            location.pathname === item.url ||
                            location.pathname.startsWith(item.url + '/')
                          ) {
                            window.location.hash = subItem.url;
                          } else {
                            // Navigate to parent URL, then set hash
                            navigate(item.url);
                            // Set hash after navigation
                            setTimeout(() => {
                              window.location.hash = subItem.url;
                            }, 0);
                          }
                        };

                        return (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton asChild isActive={subIsActive}>
                              <a href={item.url + subItem.url} onClick={(e) => { handleSubItemClick(e); closeSidebarOnMobile(); }}>
                                <span>{subItem.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          // Regular item without sub-items
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                <Link to={item.url} onClick={closeSidebarOnMobile}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
