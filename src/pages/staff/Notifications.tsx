// ✅ UPDATED: src/pages/customer/Notifications.tsx
// Works for ALL users (customer/staff/admin) because it fetches by logged-in user_id.
// Improvements:
// 1) Displays notif.title + notif.message (message supports line breaks)
// 2) Generic empty-state copy (not customer-only)
// 3) Optional type badge (helps admin/staff)

import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { formatDate } from '@utils/helpers';
import Button from '@components/common/Button';
import { supabase } from '../../supabaseClient';
import '../../assets/styles/customerdashboards.css';

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

const typeLabel: Record<string, string> = {
  reschedule_request: 'Reschedule Requested',
  cancellation_request: 'Cancellation Requested',
  booking_confirmed: 'Booking Confirmed',
  booking_completed: 'Booking Completed',
  customer_cancelled: 'Customer Cancelled',
  customer_rescheduled: 'Customer Rescheduled'
};

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user } = useAuth();

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

      setNotifications((data || []) as Notification[]);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Instant update event for sidebar badge
  const notifySidebarUpdate = (action: string, countChange: number) => {
    window.dispatchEvent(
      new CustomEvent('notificationChange', {
        detail: { action, countChange }
      })
    );
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);
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

      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, read: true, read_at: new Date().toISOString() }
            : notif
        )
      );

      if (wasUnread) notifySidebarUpdate('markAsRead', -1);
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const unreadCountBefore = notifications.filter((n) => !n.read).length;

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

      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setSuccess('All notifications marked as read!');

      if (unreadCountBefore > 0) notifySidebarUpdate('markAllAsRead', -unreadCountBefore);
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Failed to mark all as read. Please try again.');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notification = notifications.find((n) => n.id === notificationId);
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

      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      setSuccess('Notification deleted successfully!');

      if (wasUnread) notifySidebarUpdate('delete', -1);
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError('Failed to delete notification. Please try again.');
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete all notifications? This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const unreadCountBefore = notifications.filter((n) => !n.read).length;

      const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);

      if (error) {
        console.error('Error deleting all notifications:', error);
        setError('Failed to delete all notifications. Please try again.');
        return;
      }

      setNotifications([]);
      setSuccess('All notifications deleted successfully!');

      // unread badge should drop to 0
      if (unreadCountBefore > 0) notifySidebarUpdate('deleteAll', -unreadCountBefore);
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      setError('Failed to delete all notifications. Please try again.');
    }
  };

  const deleteAllReadNotifications = async () => {
    if (!user) return;

    const readCount = notifications.filter((n) => n.read).length;
    if (readCount === 0) {
      setError('No read notifications to delete.');
      return;
    }

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

      setNotifications((prev) => prev.filter((notif) => !notif.read));
      setSuccess(`${readCount} read notification(s) deleted successfully!`);

      // deleting read does not change unread badge count
      notifySidebarUpdate('deleteRead', 0);
    } catch (err) {
      console.error('Error deleting read notifications:', err);
      setError('Failed to delete read notifications. Please try again.');
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          if ((payload.new as any).read === false) notifySidebarUpdate('newNotification', 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const oldRead = (payload.old as any).read;
          const newRead = (payload.new as any).read;

          setNotifications((prev) =>
            prev.map((notif) => (notif.id === (payload.new as any).id ? (payload.new as Notification) : notif))
          );

          if (oldRead === false && newRead === true) notifySidebarUpdate('notificationRead', -1);
          if (oldRead === true && newRead === false) notifySidebarUpdate('notificationUnread', 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const wasUnread = (payload.old as any).read === false;

          setNotifications((prev) => prev.filter((notif) => notif.id !== (payload.old as any).id));

          if (wasUnread) notifySidebarUpdate('notificationDeleted', -1);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  if (loading) {
    return (
      <div className="dashboard-layout-container">
        <div className="dashboard-main-content">
          <div className="dashboard-content-wrapper">
            <DashboardHeader title="Your Notifications" />
            <div className="dashboard-loading">
              <p>Loading notifications...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="Notifications" />

          {/* Quick Stats */}
          {notifications.length > 0 && (
            <div className="quick-actions-grid" style={{ marginTop: 'var(--spacing-lg)' }}>
              {/* <div className="quick-action-card stat-card upcoming-card">
                <p className="stat-number">{notifications.length}</p>
                <p className="stat-label">Total Notifications</p>
              </div>
              <div className="quick-action-card stat-card pending-card">
                <p className="stat-number">{unreadCount}</p>
                <p className="stat-label">Unread Notifications</p>
              </div>
              <div className="quick-action-card stat-card confirmed-card">
                <p className="stat-number">{readCount}</p>
                <p className="stat-label">Read Notifications</p>
              </div> */}
            </div>
          )}

          {/* Header Actions */}
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Your Notifications</h2>
              {unreadCount > 0 && <span className="unread-badge">{unreadCount} new</span>}
            </div>

            <div className="section-actions">
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <Button variant="secondary" size="small" onClick={markAllAsRead} className="view-all-button">
                      Mark all as read
                    </Button>
                  )}
                  {readCount > 0 && (
                    <Button variant="text" size="small" onClick={deleteAllReadNotifications} className="delete-read-button">
                      Delete read ({readCount})
                    </Button>
                  )}
                  <Button variant="text" size="small" onClick={deleteAllNotifications} className="delete-all-button">
                    Delete all
                  </Button>
                </>
              )}
            </div>
          </div>

          {success && <div className="dashboard-success">{success}</div>}

          {error && (
            <div className="dashboard-error">
              {error}
              <Button variant="text" size="small" onClick={fetchNotifications} className="retry-button">
                Try Again
              </Button>
            </div>
          )}

          {/* List */}
          <div className="upcoming-bookings-section">
            {notifications.length === 0 ? (
              <div className="empty-booking-state">
                <p className="empty-message">No notifications found.</p>
                <p className="empty-subtext">Notifications will appear here when there are updates related to your account.</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor: notif.read ? 'var(--color-background)' : '#fff9f5',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 'var(--spacing-md)',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    <div
                      className="notification-content"
                      style={{ flexGrow: 1, cursor: 'pointer' }}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {!notif.read && <span className="unread-dot"></span>}

                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 999,
                            border: '1px solid var(--color-border)',
                            opacity: 0.85
                          }}
                        >
                          {typeLabel[notif.type] || notif.type}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <p
                          style={{
                            fontWeight: notif.read ? 'normal' : 'bold',
                            color: 'var(--color-primary-dark)',
                            margin: 0,
                            fontSize: '14px'
                          }}
                        >
                          {notif.title}
                        </p>

                        <p
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            color: 'var(--color-text)',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {notif.message}
                        </p>
                      </div>

                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-text-light)',
                          display: 'block',
                          marginTop: 6
                        }}
                      >
                        {formatDate(notif.created_at)}
                      </span>
                    </div>

                    <div
                      className="notification-actions"
                      style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}
                    >
                      {!notif.read && (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => markAsRead(notif.id)}
                          className="mark-read-button"
                          style={{ fontSize: '12px' }}
                        >
                          Mark Read
                        </Button>
                      )}

                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="delete-notification-button"
                        title="Delete notification"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d32f2f',
                          fontSize: '14px',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ffebee')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
