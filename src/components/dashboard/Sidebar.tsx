// src/components/dashboard/Sidebar.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  // { name: 'Dashboard', path: '/customer/dashboard', icon: MdDashboard, roles: ['customer'] },
  { name: 'Home', path: '/', icon: MdDashboard, roles: ['customer'] },
  { name: 'Browse Services', path: '/customer/services', icon: MdListAlt, roles: ['customer'] },
  // { name: 'Book Appointment', path: '/customer/book', icon: MdCalendarToday, roles: ['customer'] },
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

  // Admin Links
  { name: 'Dashboard', path: '/admin/dashboard', icon: MdDashboard, roles: ['admin'] },
  { name: 'Manage Inventory', path: '/admin/inventory', icon: MdStore, roles: ['admin'] },
  { name: 'Manage Services', path: '/admin/services', icon: MdListAlt, roles: ['admin'] },
  { name: 'Manage Staff', path: '/admin/staff', icon: MdPeople, roles: ['admin'] },
  { name: 'Manage Bookings', path: '/admin/bookings', icon: MdCalendarToday, roles: ['admin'] },
  { name: 'Activity Logs', path: '/admin/logs', icon: MdAdminPanelSettings, roles: ['admin'] },
  { name: 'Generate Reports', path: '/admin/reports', icon: MdReport, roles: ['admin'] },
];

const Sidebar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
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
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, []);

  const fetchUnreadNotifications = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    if (isLoading && !forceRefresh) return;

    try {
      setIsLoading(true);
      
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) return;

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error in fetchUnreadNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading]);

  const handleNotificationUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'INSERT' && payload.new?.read === false) {
      setUnreadCount(prev => prev + 1);
    } else if (payload.eventType === 'UPDATE' && payload.new?.read === true && payload.old?.read === false) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    } else if (payload.eventType === 'DELETE' && payload.old?.read === false) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    setTimeout(() => fetchUnreadNotifications(true), 1000);
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    const handleCustomNotificationEvent = (event: CustomEvent) => {
      const { action, countChange } = event.detail;
      
      if (countChange) {
        setUnreadCount(prev => Math.max(0, prev + countChange));
      }
      
      setTimeout(() => fetchUnreadNotifications(true), 500);
    };

    window.addEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    
    return () => {
      window.removeEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    };
  }, [fetchUnreadNotifications]);

  useEffect(() => {
    if (!user) return;

    fetchUnreadNotifications();

    const subscription = supabase
      .channel('sidebar-notifications-instant')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          handleNotificationUpdate({ ...payload, eventType: 'INSERT' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          handleNotificationUpdate({ ...payload, eventType: 'UPDATE' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          handleNotificationUpdate({ ...payload, eventType: 'DELETE' });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, handleNotificationUpdate, fetchUnreadNotifications]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchUnreadNotifications(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [user, fetchUnreadNotifications]);

  if (!isAuthenticated && !designMode) {
    return null;
  }
  
  const filteredNavItems = sidebarNavItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      <button 
        id="dashboard-menu-toggle"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
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
        <h1 id="dashboard-mobile-header-title">{userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard</h1>
        <div id="dashboard-mobile-header-actions">
          {unreadCount > 0 && (
            <span id="dashboard-notification-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <button 
            id="dashboard-mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? <MdClose /> : <MdMenu />}
          </button>
        </div>
      </div>

      <aside id="dashboard-sidebar" className={isMobileMenuOpen ? 'open' : ''}>
        <h3 id="dashboard-sidebar-title">{userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard</h3>
        <nav id="dashboard-sidebar-nav">
          <ul id="dashboard-sidebar-nav-list">
            {filteredNavItems.map((item) => (
              <li key={item.path} className="dashboard-sidebar-nav-item">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  end
                >
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