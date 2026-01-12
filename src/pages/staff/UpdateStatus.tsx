// src/pages/staff/UpdateStatus.tsx - UPDATED (supports walk-in customers + fixes null UUID issue)
// NOTE: Replace `bookings_walkin_fk` below with YOUR actual FK name (the same one that works in ManageBookings.tsx).
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
import { SupabaseNotificationService } from '../../services/supabaseNotificationService';
import "../../assets/styles/staffdashboards.css";

interface BookingWithRelations {
  id: string;

  service_id: number;
  service_name: string;
  service_price: number;
  service_duration: number;

  // registered customer (users)
  customer_id: string | null;
  customer_name: string;
  customer_email: string;

  // walk-in customer
  walk_in_customer_id: string | null;
  walk_in_customer_name: string;
  walk_in_customer_phone: string;
  isWalkIn: boolean;

  staff_id: string | null;
  staff_name: string;

  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  price: number;
  notes: string;
}

const UpdateStatus: React.FC = () => {
  const { user } = useAuth();

  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const [newStatus, setNewStatus] = useState<BookingStatus | ''>('');

  const { isOpen, openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * IMPORTANT:
   * - This MUST match the FK embed you used in ManageBookings:
   *   walkin:walk_in_customers!bookings_walkin_fk (name, phone_num)
   */
  const WALKIN_FK_JOIN = 'bookings_walkin_fk';

  const fetchStaffBookings = async () => {
    try {
      setBookingsLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your appointments.');
        setBookings([]);
        return;
      }

      // ✅ Embed relations like ManageBookings so walk-ins are handled safely
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service_id,
          customer_id,
          walk_in_customer_id,
          staff_id,
          booking_date,
          booking_time,
          status,
          total_price,
          notes,
          created_at,
          updated_at,

          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          walkin:walk_in_customers!${WALKIN_FK_JOIN} (name, phone_num)
        `)
        .eq('staff_id', user.id)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });

      if (error) throw error;

      const mapped: BookingWithRelations[] = (data || []).map((b: any) => {
        const isWalkIn = !!b.walk_in_customer_id;

        const regName = `${b.customers?.first_name || ''} ${b.customers?.last_name || ''}`.trim();
        const walkName = b.walkin?.name || '';

        const displayName = (isWalkIn ? walkName : regName) || 'Unknown Customer';

        return {
          id: b.id,

          service_id: b.service_id,
          service_name: b.services?.service_name || 'Unknown Service',
          service_price: b.services?.price ?? 0,
          service_duration: b.services?.duration ?? 60,

          customer_id: b.customer_id ?? null,
          customer_name: displayName,
          customer_email: isWalkIn ? '' : (b.customers?.email || ''),

          walk_in_customer_id: b.walk_in_customer_id ?? null,
          walk_in_customer_name: b.walkin?.name || '',
          walk_in_customer_phone: b.walkin?.phone_num || '',
          isWalkIn,

          staff_id: b.staff_id ?? null,
          staff_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Current User',

          booking_date: b.booking_date,
          booking_time: b.booking_time,
          status: b.status as BookingStatus,
          price: b.total_price ?? (b.services?.price ?? 0),
          notes: b.notes || ''
        };
      });

      setBookings(mapped);
    } catch (err: any) {
      console.error('Error fetching staff bookings:', err);
      setError(`Failed to load your appointments: ${err.message}`);
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleConfirmUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !newStatus || !user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBooking.id)
        .eq('staff_id', user.id);

      if (error) throw error;

      // ✅ Only send in-app notifications to registered users (walk-ins have no app account)
      let notificationSent = false;
      try {
        if (!selectedBooking.isWalkIn && selectedBooking.customer_id) {
          if (newStatus === 'confirmed') {
            await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_confirmed');
            notificationSent = true;
          } else if (newStatus === 'completed') {
            await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_completed');
            notificationSent = true;
          } else if (newStatus === 'cancelled') {
            await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_cancelled');
            notificationSent = true;
          }
        }
      } catch (notificationError) {
        console.error('Notification failed, but booking was updated:', notificationError);
      }

      const msg =
        selectedBooking.isWalkIn
          ? `Booking status updated to ${newStatus} successfully! (Walk-in: no in-app notification)`
          : notificationSent
            ? `Booking status updated to ${newStatus} successfully! Notification sent to customer.`
            : `Booking status updated to ${newStatus} successfully!`;

      setSuccess(msg);

      await fetchStaffBookings();

      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      console.error('Status update error:', err);
      setError(err.message || 'Failed to update booking status.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';

    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString();

    if (!time) return formattedDate;

    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`;
  };

  const getAvailableStatusOptions = (currentStatus: BookingStatus) => {
    const options: { value: BookingStatus; label: string; description: string }[] = [];

    switch (currentStatus) {
      case 'pending':
        options.push(
          { value: 'confirmed', label: 'Confirm', description: 'Confirm this appointment with the customer' },
          { value: 'cancelled', label: 'Cancel', description: 'Cancel this appointment' }
        );
        break;
      case 'confirmed':
        options.push(
          { value: 'completed', label: 'Mark Complete', description: 'Mark this appointment as completed' },
          { value: 'cancelled', label: 'Cancel', description: 'Cancel this appointment' }
        );
        break;
      case 'completed':
        options.push({ value: 'confirmed', label: 'Re-open', description: 'Re-open this completed appointment' });
        break;
      case 'cancelled':
        options.push(
          { value: 'pending', label: 'Re-activate', description: 'Re-activate this cancelled appointment' },
          { value: 'confirmed', label: 'Confirm', description: 'Confirm this cancelled appointment' }
        );
        break;
    }

    return options;
  };

  const columns = [
    {
      header: 'Service',
      key: 'service',
      render: (item: BookingWithRelations) => item.service_name
    },
    {
      header: 'Customer',
      key: 'customer',
      render: (item: BookingWithRelations) => (
        <div>
          <div className="customer-name">
            {item.customer_name}
            {item.isWalkIn && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                (Walk-in)
              </span>
            )}
          </div>

          {!item.isWalkIn ? (
            <div className="customer-email">✉️ {item.customer_email || '—'}</div>
          ) : (
            <div className="customer-email">📞 {item.walk_in_customer_phone || '—'}</div>
          )}
        </div>
      )
    },
    {
      header: 'Date & Time',
      key: 'datetime',
      render: (item: BookingWithRelations) => formatDateTime(item.booking_date, item.booking_time)
    },
    {
      header: 'Current Status',
      key: 'status',
      render: (item: BookingWithRelations) => {
        const statusClass =
          item.status === 'confirmed'
            ? 'booking-status-badge-confirmed'
            : item.status === 'completed'
              ? 'booking-status-badge-completed'
              : item.status === 'cancelled'
                ? 'booking-status-badge-cancelled'
                : 'booking-status-badge-pending';

        return (
          <span className={`booking-status-badge ${statusClass}`}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        );
      }
    },
    {
      header: 'Price',
      key: 'price',
      render: (item: BookingWithRelations) => formatCurrency(item.price)
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => {
        const availableOptions = getAvailableStatusOptions(item.status);

        return availableOptions.length > 0 ? (
          <div className="status-actions">
            {availableOptions.map(option => (
              <Button
                key={option.value}
                variant={option.value === 'cancelled' ? 'text' : 'secondary'}
                size="small"
                onClick={() => {
                  setSelectedBooking(item);
                  setNewStatus(option.value);
                  openModal();
                }}
                className={`status-button ${option.value === 'cancelled' ? 'cancel-action' : 'confirm-action'}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : (
          <span className="no-actions-label">No actions available</span>
        );
      }
    }
  ];

  const activeBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="Manage Appointments" />

          {error && <div className="dashboard-error">{error}</div>}
          {success && <div className="dashboard-success">{success}</div>}

          <div className="stats-grid">
            <div className="stat-card pending-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'pending').length}</p>
              <p className="stat-label">Pending</p>
            </div>
            <div className="stat-card confirmed-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'confirmed').length}</p>
              <p className="stat-label">Confirmed</p>
            </div>
            <div className="stat-card completed-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'completed').length}</p>
              <p className="stat-label">Completed</p>
            </div>
            <div className="stat-card total-card">
              <p className="stat-number">{bookings.length}</p>
              <p className="stat-label">Total</p>
            </div>
          </div>

          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">Active Appointments ({activeBookings.length})</h2>
              <div className="section-actions">
                <Button variant="secondary" size="small" onClick={fetchStaffBookings} className="refresh-button">
                  Refresh
                </Button>
              </div>
            </div>

            {bookingsLoading ? (
              <div className="dashboard-loading">
                <p>Loading your appointments...</p>
              </div>
            ) : activeBookings.length > 0 ? (
              <Table data={activeBookings} columns={columns} />
            ) : (
              <div className="empty-booking-state">
                <p className="empty-message">No active appointments requiring action.</p>
                <p className="empty-subtext">
                  When customers book appointments with you, they will appear here for you to confirm or manage.
                </p>
              </div>
            )}
          </div>

          {bookings.length > 0 && (
            <div className="recent-bookings-section">
              <details className="recent-bookings-details">
                <summary className="recent-bookings-summary">
                  All Appointments ({bookings.length})
                  <span className="dropdown-icon">▼</span>
                </summary>
                <div className="recent-bookings-content">
                  <Table data={bookings} columns={columns} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Update Status Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Update Appointment Status">
        {selectedBooking && (
          <>
            <div className="modal-booking-info">
              <p className="booking-service">
                Updating status for <strong>{selectedBooking.service_name}</strong>
              </p>

              <p className="booking-detail">
                Customer: <strong>{selectedBooking.customer_name}</strong>
                {selectedBooking.isWalkIn && (
                  <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                    (Walk-in)
                  </span>
                )}
              </p>

              {selectedBooking.isWalkIn ? (
                <p className="booking-detail">
                  Phone: <strong>{selectedBooking.walk_in_customer_phone || '—'}</strong>
                </p>
              ) : (
                <p className="booking-detail">
                  Email: <strong>{selectedBooking.customer_email || '—'}</strong>
                </p>
              )}

              <p className="booking-detail">
                Date: <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>
              </p>
              <p className="booking-detail">
                Current Status: <strong>{selectedBooking.status}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmUpdate} className="update-status-form">
              <div className="form-group">
                <label htmlFor="new-status">Update Status To</label>
                <select
                  id="new-status"
                  className="form-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as BookingStatus)}
                  required
                >
                  <option value="">-- Select New Status --</option>
                  {getAvailableStatusOptions(selectedBooking.status).map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.value})
                    </option>
                  ))}
                </select>

                {newStatus && (
                  <small className="status-description">
                    {getAvailableStatusOptions(selectedBooking.status).find(opt => opt.value === newStatus)?.description}
                  </small>
                )}
              </div>

              {error && <div className="form-error">{error}</div>}
              {success && <div className="form-success">{success}</div>}

              <div className="modal-actions">
                <Button variant="secondary" onClick={closeModal} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading || !newStatus}>
                  {loading ? 'Updating...' : 'Confirm Update'}
                </Button>
              </div>

              {selectedBooking.isWalkIn && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  Note: Walk-in bookings do not receive in-app notifications.
                </div>
              )}
            </form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default UpdateStatus;
