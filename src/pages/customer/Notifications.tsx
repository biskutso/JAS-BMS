// src/pages/customer/Notifications.tsx
import React from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { formatDate } from '@utils/helpers';
import Button from '@components/common/Button'; // <--- Add this line
// Make sure the path matches your actual Button component location

interface Notification {
  id: string;
  message: string;
  date: string; // ISO string
  read: boolean;
}

const dummyNotifications: Notification[] = [
  { id: 'n1', message: 'Your "Luxury Hydration Facial" on Nov 10th is confirmed.', date: '2023-10-28T09:00:00Z', read: false },
  { id: 'n2', message: 'Reminder: Your appointment for "Aromatherapy Massage" is tomorrow!', date: '2023-11-14T10:00:00Z', read: false },
  { id: 'n3', message: 'Welcome to Joyce Aesthetic Salon & Spa! Enjoy your first visit.', date: '2023-10-25T15:30:00Z', read: true },
  { id: 'n4', message: 'Your booking for "Deluxe Manicure & Pedicure" on Nov 5th was completed.', date: '2023-11-05T11:00:00Z', read: true },
];

const Notifications: React.FC = () => {
  const notifications = dummyNotifications.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <>
      <DashboardHeader title="Your Notifications" />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Stay updated with your appointments, special offers, and important announcements.
        </p>
        <div className="notifications-list">
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center' }}>No new notifications.</p>
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
                <div style={{ flexGrow: 1 }}>
                  <p style={{ fontWeight: notif.read ? 'normal' : 'bold', color: 'var(--color-primary-dark)', marginBottom: '4px' }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                    {formatDate(notif.date)}
                  </span>
                </div>
                {!notif.read && (
                  <Button variant="text" size="small">Mark as Read</Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Notifications;