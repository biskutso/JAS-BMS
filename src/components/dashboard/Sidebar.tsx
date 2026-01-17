// src/components/dashboard/Sidebar.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { IconType } from 'react-icons';
import {
  MdDashboard, MdPerson, MdCalendarToday, MdListAlt, MdStore,
  MdPeople, MdSettings, MdHistory, MdNotifications, MdReport,
  MdEventAvailable, MdMenu, MdClose, MdAdminPanelSettings
} from 'react-icons/md';
import { supabase } from '../../supabaseClient';

interface NavItem {
  name: string;
  path: string;
  icon: IconType;
  roles: string[];
  showNotification?: boolean;
}

const sidebarNavItems: NavItem[] = [
  // Customer Links
  { name: 'Home', path: '/', icon: MdDashboard, roles: ['customer'] },
  { name: 'Browse Services', path: '/customer/services', icon: MdListAlt, roles: ['customer'] },
  { name: 'Booking History', path: '/customer/manage-bookings', icon: MdHistory, roles: ['customer'] },
  {
    name: 'Notifications',
    path: '/customer/notifications',
    icon: MdNotifications,
    roles: ['customer'],
    showNotification: true
  },

  // Staff Links
  { name: 'Dashboard', path: '/staff/dashboard', icon: MdDashboard, roles: ['staff'] },
  { name: 'My Schedule', path: '/staff/schedule', icon: MdEventAvailable, roles: ['staff'] },
  { name: 'Update Status', path: '/staff/update-status', icon: MdSettings, roles: ['staff'] },
  {
    name: 'Notifications',
    path: '/staff/notifications',
    icon: MdNotifications,
    roles: ['staff'],
    showNotification: true
  },

  // Admin Links
  { name: 'Dashboard', path: '/admin/dashboard', icon: MdDashboard, roles: ['admin'] },
  { name: 'Manage Inventory', path: '/admin/inventory', icon: MdStore, roles: ['admin'] },
  { name: 'Manage Services', path: '/admin/services', icon: MdListAlt, roles: ['admin'] },
  { name: 'Manage Staff', path: '/admin/staff', icon: MdPeople, roles: ['admin'] },
  { name: 'Manage Bookings', path: '/admin/bookings', icon: MdCalendarToday, roles: ['admin'] },
  { name: 'Activity Logs', path: '/admin/logs', icon: MdAdminPanelSettings, roles: ['admin'] },
  { name: 'Generate Reports', path: '/admin/reports', icon: MdReport, roles: ['admin'] },
  {
    name: 'Notifications',
    path: '/admin/notifications',
    icon: MdNotifications,
    roles: ['admin'],
    showNotification: true
  },
];

const Sidebar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  const designMode = true;
  const userRole = user?.role || 'customer';

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, []);

  // ✅ only fetch count when needed (no loops)
  const fetchUnreadNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);

      const { error, count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true }) // ✅ smaller payload than '*'
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.warn('Unread count fetch error:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Error in fetchUnreadNotifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // ✅ 1) Initial fetch once per user
  useEffect(() => {
    if (!userId) return;
    fetchUnreadNotifications();
  }, [userId, fetchUnreadNotifications]);

  // ✅ 2) Re-fetch when tab becomes visible/focused (helps after idle) — OPTIONAL but useful
  useEffect(() => {
    if (!userId) return;

    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchUnreadNotifications();
    };
    const onFocus = () => void fetchUnreadNotifications();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, fetchUnreadNotifications]);

  // ✅ 3) Realtime updates: update badge in-memory ONLY (NO DB refetch)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`sidebar-notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const isUnread = (payload.new as any)?.read === false;
          if (isUnread) setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const oldRead = (payload.old as any)?.read;
          const newRead = (payload.new as any)?.read;

          if (oldRead === false && newRead === true) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } else if (oldRead === true && newRead === false) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const wasUnread = (payload.old as any)?.read === false;
          if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // ✅ 4) Custom events from Notifications page: adjust badge only (NO DB refetch)
  useEffect(() => {
    const handleCustomNotificationEvent = (event: CustomEvent) => {
      const { countChange } = event.detail || {};
      if (typeof countChange === 'number' && countChange !== 0) {
        setUnreadCount((prev) => Math.max(0, prev + countChange));
      }
    };

    window.addEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    return () => {
      window.removeEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    };
  }, []);

  if (!isAuthenticated && !designMode) {
    return null;
  }

  const filteredNavItems = useMemo(
    () => sidebarNavItems.filter((item) => item.roles.includes(userRole)),
    [userRole]
  );

  return (
    <>
      <button
        id="dashboard-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isMobileMenuOpen}
      >
        {isMobileMenuOpen ? <MdClose /> : <MdMenu />}
      </button>

      <div
        id="dashboard-mobile-overlay"
        className={isMobileMenuOpen ? 'active' : ''}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <div id="dashboard-mobile-header">
        <h1 id="dashboard-mobile-header-title">
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard
        </h1>
        <div id="dashboard-mobile-header-actions">
          {unreadCount > 0 && (
            <span id="dashboard-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
          <button
            id="dashboard-mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <MdClose /> : <MdMenu />}
          </button>
        </div>
      </div>

      <aside id="dashboard-sidebar" className={isMobileMenuOpen ? 'open' : ''}>
        <h3 id="dashboard-sidebar-title">
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard
        </h3>

        <nav id="dashboard-sidebar-nav">
          <ul id="dashboard-sidebar-nav-list">
            {filteredNavItems.map((item) => (
              <li key={item.path} className="dashboard-sidebar-nav-item">
                <NavLink to={item.path} className={({ isActive }) => (isActive ? 'active' : '')} end>
                  <div id={`dashboard-nav-item-${item.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    <item.icon className="dashboard-nav-icon" />
                    <span className="dashboard-nav-text">{item.name}</span>

                    {item.showNotification && unreadCount > 0 && (
                      <span
                        id="dashboard-sidebar-notification-badge"
                        className={isLoading ? 'pulsing' : ''}
                        title={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
