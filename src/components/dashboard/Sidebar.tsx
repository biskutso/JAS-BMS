// src/components/dashboard/Sidebar.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { IconType } from 'react-icons';
import {
  MdDashboard, MdPerson, MdCalendarToday, MdListAlt, MdStore,
  MdPeople, MdSettings, MdHistory, MdNotifications, MdReport, MdEventAvailable
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
  { name: 'Dashboard', path: '/customer/dashboard', icon: MdDashboard, roles: ['customer'] },
  { name: 'Browse Services', path: '/customer/services', icon: MdListAlt, roles: ['customer'] },
  { name: 'Book Appointment', path: '/customer/book', icon: MdCalendarToday, roles: ['customer'] },
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
  { name: 'Generate Reports', path: '/admin/reports', icon: MdReport, roles: ['admin'] },
];

const Sidebar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const designMode = true;
  const userRole = user?.role || 'customer';

  // Optimized fetch with caching and instant updates
  const fetchUnreadNotifications = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    // Prevent multiple simultaneous requests
    if (isLoading && !forceRefresh) return;

    try {
      setIsLoading(true);
      
      const { data, error, count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        // console.error('❌ Sidebar: Error fetching unread notifications:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (error) {
      // console.error('❌ Sidebar: Error in fetchUnreadNotifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading]);

  // INSTANT UPDATE: Local state management for immediate feedback
  const handleNotificationUpdate = useCallback((payload: any) => {
    // console.log('📢 Sidebar: Processing real-time update', payload);
    
    // INSTANT UPDATE: Update count immediately based on the event
    if (payload.eventType === 'INSERT' && payload.new?.read === false) {
      // New unread notification added
      setUnreadCount(prev => prev + 1);
    } else if (payload.eventType === 'UPDATE' && payload.new?.read === true && payload.old?.read === false) {
      // Notification marked as read
      setUnreadCount(prev => Math.max(0, prev - 1));
    } else if (payload.eventType === 'DELETE' && payload.old?.read === false) {
      // Unread notification deleted
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Still refresh from server to ensure accuracy, but with delay
    setTimeout(() => fetchUnreadNotifications(true), 1000);
  }, [fetchUnreadNotifications]);

  // Custom event listener for instant updates from Notifications page
  useEffect(() => {
    const handleCustomNotificationEvent = (event: CustomEvent) => {
      // console.log('📢 Sidebar: Custom event received', event.detail);
      const { action, countChange } = event.detail;
      
      // INSTANT UPDATE: Adjust count immediately
      if (countChange) {
        setUnreadCount(prev => Math.max(0, prev + countChange));
      }
      
      // Refresh from server after a short delay
      setTimeout(() => fetchUnreadNotifications(true), 500);
    };

    window.addEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    
    return () => {
      window.removeEventListener('notificationChange', handleCustomNotificationEvent as EventListener);
    };
  }, [fetchUnreadNotifications]);

  // Real-time subscription with instant updates
  useEffect(() => {
    if (!user) return;

    // Fetch initial count
    fetchUnreadNotifications();

    // console.log('🔄 Sidebar: Setting up optimized real-time subscription...');

    // Subscribe to notification changes
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
          // console.log('📢 Sidebar: INSERT event', payload);
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
          // console.log('📢 Sidebar: UPDATE event', payload);
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
          // console.log('📢 Sidebar: DELETE event', payload);
          handleNotificationUpdate({ ...payload, eventType: 'DELETE' });
        }
      )
      .subscribe((status) => {
        // console.log('📢 Sidebar: Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          // console.log('✅ Sidebar: Real-time subscription active');
        }
      });

    return () => {
      // console.log('🔄 Sidebar: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [user, handleNotificationUpdate, fetchUnreadNotifications]);

  // Polling as fallback (less frequent since we have instant updates)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchUnreadNotifications(true);
    }, 60000); // Refresh every 60 seconds as backup

    return () => clearInterval(interval);
  }, [user, fetchUnreadNotifications]);

  if (!isAuthenticated && !designMode) {
    return null;
  }

  const filteredNavItems = sidebarNavItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="sidebar">
      <h3>{userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard</h3>
      <nav className="sidebar-nav">
        <ul>
          {filteredNavItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => (isActive ? 'active' : '')}
                end
              >
                <div className="nav-item-content">
                  <item.icon className="nav-icon" />
                  <span className="nav-text">{item.name}</span>
                  
                  {item.showNotification && unreadCount > 0 && (
                    <span 
                      className={`notification-badge ${isLoading ? 'pulsing' : ''}`}
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
  );
};

export default Sidebar;