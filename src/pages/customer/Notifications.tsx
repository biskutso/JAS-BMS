// src/pages/customer/Notifications.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { formatDate } from '@utils/helpers';
import Button from '@components/common/Button';
import { supabase } from '../../supabaseClient';

interface Notification {
  id: string;
  user_id: string;
  booking_id?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  read_at?: string;
}

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch notifications from Supabase
  const fetchNotifications = async () => {
    if (!user) {
      setError('Please log in to view notifications');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      console.log('🔄 Fetching notifications for user:', user.id);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching notifications:', error);
        setError('Failed to load notifications. Please try again.');
        return;
      }

      console.log('✅ Notifications fetched successfully');
      setNotifications(data || []);

    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 INSTANT UPDATE: Send custom event to sidebar
  const notifySidebarUpdate = (action: string, countChange: number) => {
    console.log(`📢 Notifications: Sending ${action} event to sidebar, count change: ${countChange}`);
    window.dispatchEvent(new CustomEvent('notificationChange', {
      detail: {
        action,
        countChange
      }
    }));
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      const wasUnread = notification?.read === false;

      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId 
            ? { ...notif, read: true, read_at: new Date().toISOString() }
            : notif
        )
      );

      // 🔥 INSTANT UPDATE: Notify sidebar if we marked an unread notification as read
      if (wasUnread) {
        notifySidebarUpdate('markAsRead', -1);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const unreadCountBefore = notifications.filter(n => !n.read).length;

      const { error } = await supabase
        .from('notifications')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        setError('Failed to mark all as read. Please try again.');
        return;
      }

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
      setSuccess('All notifications marked as read!');

      // 🔥 INSTANT UPDATE: Notify sidebar about all unread notifications being marked as read
      if (unreadCountBefore > 0) {
        notifySidebarUpdate('markAllAsRead', -unreadCountBefore);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      setError('Failed to mark all as read. Please try again.');
    }
  };

  // Delete single notification
  const deleteNotification = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      const wasUnread = notification?.read === false;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) {
        console.error('Error deleting notification:', error);
        setError('Failed to delete notification. Please try again.');
        return;
      }

      // Remove from local state
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      setSuccess('Notification deleted successfully!');

      // 🔥 INSTANT UPDATE: Notify sidebar if we deleted an unread notification
      if (wasUnread) {
        notifySidebarUpdate('delete', -1);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification. Please try again.');
    }
  };

  // Delete all notifications
  const deleteAllNotifications = async () => {
    if (!user) return;

    // Confirm before deleting all
    const confirmed = window.confirm(
      'Are you sure you want to delete all notifications? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    try {
      const unreadCountBefore = notifications.filter(n => !n.read).length;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting all notifications:', error);
        setError('Failed to delete all notifications. Please try again.');
        return;
      }

      // Clear local state
      setNotifications([]);
      setSuccess('All notifications deleted successfully!');

      // 🔥 INSTANT UPDATE: Notify sidebar about all notifications being deleted
      notifySidebarUpdate('deleteAll', -notifications.length);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      setError('Failed to delete all notifications. Please try again.');
    }
  };

  // Delete all read notifications
  const deleteAllReadNotifications = async () => {
    if (!user) return;

    const readCount = notifications.filter(n => n.read).length;
    if (readCount === 0) {
      setError('No read notifications to delete.');
      return;
    }

    // Confirm before deleting read notifications
    const confirmed = window.confirm(
      `Are you sure you want to delete ${readCount} read notification(s)? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('read', true);

      if (error) {
        console.error('Error deleting read notifications:', error);
        setError('Failed to delete read notifications. Please try again.');
        return;
      }

      // Remove read notifications from local state
      setNotifications(prev => prev.filter(notif => !notif.read));
      setSuccess(`${readCount} read notification(s) deleted successfully!`);

      // 🔥 INSTANT UPDATE: Notify sidebar about read notifications being deleted
      // Note: Since these are already read, they don't affect the unread count
      // But we still notify to ensure sidebar state is accurate
      notifySidebarUpdate('deleteRead', 0);
    } catch (error) {
      console.error('Error deleting read notifications:', error);
      setError('Failed to delete read notifications. Please try again.');
    }
  };

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    // Fetch initial notifications
    fetchNotifications();

    // Subscribe to new notifications
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📢 New notification received:', payload.new);
          setNotifications(prev => [payload.new as Notification, ...prev]);
          
          // 🔥 INSTANT UPDATE: Notify sidebar about new notification if it's unread
          if (payload.new.read === false) {
            notifySidebarUpdate('newNotification', 1);
          }
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
          console.log('📢 Notification updated:', payload.new);
          setNotifications(prev =>
            prev.map(notif =>
              notif.id === payload.new.id ? payload.new as Notification : notif
            )
          );

          // 🔥 INSTANT UPDATE: Notify sidebar if read status changed
          if (payload.old.read === false && payload.new.read === true) {
            notifySidebarUpdate('notificationRead', -1);
          } else if (payload.old.read === true && payload.new.read === false) {
            notifySidebarUpdate('notificationUnread', 1);
          }
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
          console.log('📢 Notification deleted:', payload.old);
          setNotifications(prev => prev.filter(notif => notif.id !== payload.old.id));

          // 🔥 INSTANT UPDATE: Notify sidebar if deleted notification was unread
          if (payload.old.read === false) {
            notifySidebarUpdate('notificationDeleted', -1);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const readCount = notifications.filter(n => n.read).length;

  // Auto-clear success messages after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <>
        <DashboardHeader title="Your Notifications" />
        <div className="page-container">
          <p>Loading notifications...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardHeader title="Your Notifications" />
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
          <p className="section-subtitle" style={{ textAlign: 'left', margin: 0 }}>
            Stay updated with your appointments, special offers, and important announcements.
            {unreadCount > 0 && (
              <span style={{ 
                marginLeft: '8px', 
                backgroundColor: 'var(--color-accent)', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px',
                fontSize: '0.8rem'
              }}>
                {unreadCount} new
              </span>
            )}
          </p>
          
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {notifications.length > 0 && (
              <>
                {unreadCount > 0 && (
                  <Button variant="secondary" size="small" onClick={markAllAsRead}>
                    Mark all as read
                  </Button>
                )}
                {readCount > 0 && (
                  <Button 
                    variant="text" 
                    size="small" 
                    onClick={deleteAllReadNotifications}
                    style={{ color: '#666' }}
                  >
                    Delete read ({readCount})
                  </Button>
                )}
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={deleteAllNotifications}
                  style={{ color: '#d32f2f' }}
                >
                  Delete all
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            backgroundColor: '#e8f5e8',
            border: '1px solid #c8e6c9',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#fee',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {error}
            <Button 
              variant="text" 
              size="small" 
              onClick={fetchNotifications}
              style={{ marginLeft: '8px' }}
            >
              Try Again
            </Button>
          </div>
        )}

        <div className="notifications-list">
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>No notifications found.</p>
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '8px' }}>
                Notifications will appear here when staff update your booking status.
              </p>
            </div>
          ) : (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: notif.read ? 'var(--color-background)' : '#fff9f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <div 
                  style={{ flexGrow: 1, cursor: 'pointer' }}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                >
                  <p style={{ 
                    fontWeight: notif.read ? 'normal' : 'bold', 
                    color: 'var(--color-primary-dark)', 
                    marginBottom: '4px' 
                  }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                    {formatDate(notif.created_at)}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!notif.read && (
                    <Button 
                      variant="text" 
                      size="small"
                      onClick={() => markAsRead(notif.id)}
                      style={{ fontSize: '12px' }}
                    >
                      Mark as Read
                    </Button>
                  )}
                  <Button 
                    variant="text" 
                    size="small"
                    onClick={() => deleteNotification(notif.id)}
                    style={{ 
                      fontSize: '12px', 
                      color: '#d32f2f',
                      minWidth: 'auto'
                    }}
                    title="Delete notification"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Stats */}
        {notifications.length > 0 && (
          <div style={{ 
            marginTop: 'var(--spacing-xl)',
            padding: 'var(--spacing-md)',
            backgroundColor: '#f8f9fa',
            borderRadius: 'var(--border-radius)',
            border: '1px solid #e9ecef',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            <strong>Notification Summary:</strong> 
            <span style={{ margin: '0 12px' }}>
              📥 Total: <strong>{notifications.length}</strong>
            </span>
            <span style={{ margin: '0 12px' }}>
              📬 Unread: <strong>{unreadCount}</strong>
            </span>
            <span style={{ margin: '0 12px' }}>
              📭 Read: <strong>{readCount}</strong>
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;