// src/pages/staff/CheckSchedule.tsx - UPDATED (supports walk-ins + avoids null UUID issues)
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
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

  // registered customer
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
  notes?: string;
}

const CheckSchedule: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * IMPORTANT:
   * Use the SAME join name you used in ManageBookings.tsx:
   * walkin:walk_in_customers!bookings_walkin_fk (name, phone_num)
   * If your FK join name differs, change this constant to match.
   */
  const WALKIN_FK_JOIN = 'bookings_walkin_fk';

  const fetchStaffBookingsSimple = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your schedule.');
        setBookings([]);
        return;
      }

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
          updated_at,

          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          walkin:walk_in_customers!${WALKIN_FK_JOIN} (name, phone_num)
        `)
        .eq('staff_id', user.id)
        .eq('booking_date', selectedDate)
        .order('booking_time', { ascending: true });

      if (error) throw error;

      const staffBookings: BookingWithRelations[] = (data || []).map((b: any) => {
        const isWalkIn = !!b.walk_in_customer_id;

        const regName = `${b.customers?.first_name || ''} ${b.customers?.last_name || ''}`.trim();
        const walkName = b.walkin?.name || '';
        const displayName = (isWalkIn ? walkName : regName) || 'Customer';

        return {
          id: b.id,

          service_id: b.service_id,
          service_name: b.services?.service_name || 'Service',
          service_price: b.services?.price ?? (b.total_price ?? 0),
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

      setBookings(staffBookings);
    } catch (err: any) {
      console.error('Schedule fetch failed:', err);
      setError(`Unable to load schedule data: ${err.message}`);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookingsSimple();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedDate]);

  const updateBookingStatus = async (booking: BookingWithRelations, newStatus: BookingStatus) => {
    try {
      setError(null);
      setSuccess(null);

      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id)
        .eq('staff_id', user?.id);

      if (error) throw error;

      // ✅ Only notify registered users (walk-ins have no user_id)
      let notificationSent = false;
      if (!booking.isWalkIn && booking.customer_id) {
        try {
          if (newStatus === 'confirmed') {
            await SupabaseNotificationService.createBookingNotification(booking.id, 'booking_confirmed');
            notificationSent = true;
          } else if (newStatus === 'completed') {
            await SupabaseNotificationService.createBookingNotification(booking.id, 'booking_completed');
            notificationSent = true;
          } else if (newStatus === 'cancelled') {
            await SupabaseNotificationService.createBookingNotification(booking.id, 'booking_cancelled');
            notificationSent = true;
          }
        } catch (notificationError) {
          console.error('Notification failed, but booking was updated:', notificationError);
        }
      }

      await fetchStaffBookingsSimple();

      const successMessage =
        booking.isWalkIn
          ? `Booking status updated to ${newStatus}! (Walk-in: no app notification)`
          : (notificationSent
              ? `Booking status updated to ${newStatus}! Customer notified.`
              : `Booking status updated to ${newStatus}!`);

      setSuccess(successMessage);
    } catch (err: any) {
      console.error('Error updating booking status:', err);
      setError(`Failed to update booking status: ${err.message}`);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const calculateEndTime = (startTime: string, duration: number) => {
    if (!startTime) return 'N/A';
    const [hours, minutes] = startTime.split(':');
    const startDate = new Date();
    startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    const endDate = new Date(startDate.getTime() + duration * 60000);
    const endHours = endDate.getHours();
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    const ampm = endHours >= 12 ? 'PM' : 'AM';
    const displayHour = endHours % 12 || 12;
    return `${displayHour}:${endMinutes} ${ampm}`;
  };

  const columns = [
    {
      header: 'Time',
      key: 'booking_time',
      render: (item: BookingWithRelations) => (
        <div>
          <div className="time-slot">{formatTime(item.booking_time)}</div>
          <div className="time-end">to {calculateEndTime(item.booking_time, item.service_duration)}</div>
        </div>
      )
    },
    {
      header: 'Service',
      key: 'serviceName',
      render: (item: BookingWithRelations) => item.service_name
    },
    {
      header: 'Customer',
      key: 'customerName',
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
      header: 'Duration',
      key: 'service_duration',
      render: (item: BookingWithRelations) => `${item.service_duration} min`
    },
    {
      header: 'Price',
      key: 'price',
      render: (item: BookingWithRelations) => formatCurrency(item.price)
    },
    {
      header: 'Status',
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
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => (
        <div className="schedule-actions">
          {item.status === 'pending' && (
          <>
            <Button
              variant="secondary"
              size="small"
              onClick={() => updateBookingStatus(item, 'confirmed')}
              className="confirm-button"
            >
              Confirm
            </Button>
            <Button
                variant="text"
                size="small"
                onClick={() => updateBookingStatus(item, 'cancelled')}
                className="cancel-button"
              >
                Cancel
              </Button>
            </>
          )}

          {/* Confirmed → Complete + Cancel */}
          {item.status === 'confirmed' && (
            <>
              <Button
                variant="secondary"
                size="small"
                onClick={() => updateBookingStatus(item, 'completed')}
                className="complete-button"
              >
                Mark Complete
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => updateBookingStatus(item, 'cancelled')}
                className="cancel-button"
              >
                Cancel
              </Button>
            </>
          )}

          {/* Completed */}
          {item.status === 'completed' && (
            <span className="completed-label">Completed</span>
          )}

          {/* Cancelled */}
          {item.status === 'cancelled' && (
            <span className="cancelled-label">Cancelled</span>
          )}

        </div>
      )
    }
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="My Schedule" />

          <div className="date-selection">
            <label htmlFor="schedule-date" className="date-label">Select Date:</label>
            <input
              type="date"
              id="schedule-date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
            <Button
              variant="secondary"
              size="small"
              onClick={fetchStaffBookingsSimple}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {success && <div className="dashboard-success">{success}</div>}

          {error && (
            <div className="dashboard-error">
              {error}
              <div className="error-actions">
                <Button
                  variant="text"
                  size="small"
                  onClick={fetchStaffBookingsSimple}
                  className="retry-button"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Schedule for {formatDate(selectedDate)}
              </h2>
              <div className="section-actions">
                <span className="appointment-count">
                  {bookings.length} appointment{bookings.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading your schedule...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="empty-booking-state">
                <p className="empty-message">No appointments scheduled for {formatDate(selectedDate)}.</p>
                <p className="empty-subtext">
                  When customers book appointments and select you as their preferred staff (or an admin assigns you a walk-in),
                  they will appear here.
                </p>
              </div>
            ) : (
              <Table
                data={bookings}
                columns={columns}
                caption={`Your Appointments for ${formatDate(selectedDate)}`}
              />
            )}
          </div>

          <div className="info-banner">
            <h4 className="banner-title">Schedule Notes</h4>
            <ul className="banner-list">
              <li>Walk-in bookings show a phone number instead of email.</li>
              <li>Customers receive notifications when you update appointment status (walk-ins do not).</li>
              <li>Only bookings assigned to you appear here.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckSchedule;
