// src/pages/customer/CancelReschedule.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
import '../../assets/styles/customerdashboards.css';

interface BookingWithRelations extends Booking {
  service_name: string;
  service_price: number;
  service_duration: number;
  customer_name: string;
  customer_email: string;
  staff_name: string;
  staff_email: string;
  booking_date: string;
  booking_time: string;
}

const RESCHEDULE_REASONS = [
  'Schedule conflict',
  'Emergency',
  'Not available on that date',
  'Other (please specify)'
];

const CANCELLATION_REASONS = [
  'Schedule conflict',
  'Emergency',
  'Changed my mind',
  'Booked by mistake',
  'Other (please specify)'
];

const CancelReschedule: React.FC = () => {
  const { user } = useAuth();

  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);

  const { isOpen: isRescheduleModalOpen, openModal: openRescheduleModal, closeModal: closeRescheduleModal } =
    useModal();

  // Reason + confirmation flow
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState<'cancel' | 'reschedule' | null>(null);

  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [finalReason, setFinalReason] = useState('');

  const [confirmNotice, setConfirmNotice] = useState<string | null>(null);

  // Reschedule inputs
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ----------------------------- FETCH CUSTOMER BOOKINGS -----------------------------
  const fetchCustomerBookings = async () => {
    try {
      setBookingsLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your bookings.');
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select(
          `
          *,
          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          staff:staff_id (first_name, last_name, email)
        `
        )
        .eq('customer_id', user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;

      const customerBookings: BookingWithRelations[] = (data || []).map((booking: any) => ({
        // Booking base
        id: booking.id,
        serviceId: booking.service_id,
        serviceName: booking.services?.service_name || 'Unknown Service',

        customerId: booking.customer_id,
        customerName:
          `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',

        staffId: booking.staff_id,
        staffName: booking.staff
          ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim()
          : 'Unassigned',

        startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',

        status: booking.status as BookingStatus,
        price: booking.total_price || booking.services?.price || 0,
        notes: booking.notes || '',

        // Relations (your UI needs these)
        service_name: booking.services?.service_name || 'Unknown Service',
        service_price: booking.services?.price || 0,
        service_duration: booking.services?.duration || 60,

        customer_name:
          `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        customer_email: booking.customers?.email || '',

        staff_name: booking.staff
          ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim()
          : 'Unassigned',
        staff_email: booking.staff?.email || '',

        booking_date: booking.booking_date,
        booking_time: booking.booking_time
      }));

      setBookings(customerBookings);
    } catch (err: any) {
      console.error('Error fetching customer bookings:', err);
      setError('Failed to load your bookings. Please try again.');
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerBookings();
  }, [user]);

  // ----------------------------- HELPERS -----------------------------
  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString();
    if (!time) return formattedDate;
    return `${formattedDate} at ${time}`;
  };

  const resetReasonFlow = () => {
    setSelectedReason('');
    setCustomReason('');
    setFinalReason('');
    setConfirmNotice(null);
    setShowReasonModal(false);
    setShowConfirmModal(false);
    setActionType(null);
  };

  // ----------------------------- NOTIFY ADMINS + ASSIGNED STAFF -----------------------------
  const notifyAdminsAndStaff = async (
    booking: BookingWithRelations,
    notificationType: 'customer_cancelled' | 'customer_rescheduled',
    reasonText: string,
    newDate?: string,
    newTime?: string
  ) => {
    console.log('🔔 notifyAdminsAndStaff() START');

    // ✅ admins
    const { data: admins, error: adminErr } = await supabase
      .from('users')
      .select('id, role')
      .ilike('role', 'admin');

    if (adminErr) {
      console.error('❌ Failed to fetch admins:', adminErr);
      throw adminErr;
    }

    // ✅ recipients = admins + assigned staff (if any)
    const recipientIds = new Set<string>();
    (admins || []).forEach((a: any) => a?.id && recipientIds.add(String(a.id)));
    if (booking.staffId) recipientIds.add(String(booking.staffId)); // staff assigned

    if (recipientIds.size === 0) {
      console.warn('⚠️ No recipients found (admins/staff).');
      return;
    }

    const fromWhen = `${booking.booking_date} ${booking.booking_time}`;

    const title =
      notificationType === 'customer_cancelled'
        ? '❌ Customer Cancelled a Booking'
        : '🔁 Customer Rescheduled a Booking';

    const message =
      notificationType === 'customer_cancelled'
        ? `Customer cancelled **${booking.service_name}** on **${fromWhen}**.\n\n**Reason:** ${reasonText}`
        : `Customer rescheduled **${booking.service_name}**.\n\n**From:** ${fromWhen}\n**To:** ${newDate} ${newTime}\n\n**Reason:** ${reasonText}`;

    const rows = Array.from(recipientIds).map((id) => ({
      user_id: id,
      booking_id: booking.id,
      type: notificationType,
      title,
      message,
      read: false,
      created_at: new Date().toISOString()
    }));

    console.log('🧾 Inserting notifications:', rows);

    const { error: insertErr } = await supabase.from('notifications').insert(rows);
    if (insertErr) {
      console.error('❌ Insert notifications failed:', insertErr);
      throw insertErr;
    }

    console.log('✅ Notifications inserted successfully!');
    return true;
  };

  // ----------------------------- RESCHEDULE SLOT CHECK -----------------------------
  const isTimeSlotAvailable = async (
    date: string,
    time: string,
    staffId: string,
    excludeBookingId?: string
  ): Promise<boolean> => {
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('staff_id', staffId)
        .in('status', ['pending', 'confirmed']);

      if (excludeBookingId) query = query.neq('id', excludeBookingId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true;
    }
  };

  const getAvailableTimeSlots = () => {
    const slots: string[] = [];
    const startHour = 9;
    const endHour = 18;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isToday = rescheduleDate === now.toISOString().split('T')[0];

    for (let hour = startHour; hour < endHour; hour++) {
      if (!isToday || hour > currentHour || (hour === currentHour && currentMinute < 30)) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }

      if (hour < endHour - 1) {
        if (!isToday || hour > currentHour || (hour === currentHour && currentMinute <= 30)) {
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
    }

    return slots;
  };

  const handleRescheduleDateChange = (date: string) => {
    setRescheduleDate(date);
    setRescheduleError(null);

    if (date && rescheduleTime) {
      const timeSlots = getAvailableTimeSlots();
      if (!timeSlots.includes(rescheduleTime)) setRescheduleTime('');
    }
  };

  const handleRescheduleTimeChange = (time: string) => {
    setRescheduleTime(time);
    setRescheduleError(null);
  };

  // ----------------------------- START FLOWS -----------------------------
  const handleCancelClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setActionType('cancel');
    setSelectedReason('');
    setCustomReason('');
    setFinalReason('');
    setConfirmNotice(null);
    setShowReasonModal(true);
  };

  const handleRescheduleClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setRescheduleDate(booking.booking_date || '');
    setRescheduleTime(booking.booking_time || '');
    setRescheduleError(null);
    openRescheduleModal();
  };

  // STEP 0: reschedule modal submit -> reason modal (no DB update yet)
  const handleRescheduleNext = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBooking || !rescheduleDate || !rescheduleTime || !user) {
      setRescheduleError('Please provide a new date and time.');
      return;
    }

    closeRescheduleModal();
    setActionType('reschedule');

    setSelectedReason('');
    setCustomReason('');
    setFinalReason('');
    setConfirmNotice(null);

    setShowReasonModal(true);
  };

  // STEP 1: reason modal -> confirm modal
  const proceedToConfirm = () => {
    const r = selectedReason === 'Other (please specify)' ? customReason.trim() : selectedReason;
    setFinalReason(r);
    setShowReasonModal(false);
    setShowConfirmModal(true);
  };

  // STEP 2: final confirm -> execute + notify + refresh + auto-close
  const executeFinalAction = async () => {
    if (!selectedBooking || !user || !actionType || !finalReason) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setConfirmNotice('Processing...');

    try {
      if (actionType === 'cancel') {
        const { error: cancelErr } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedBooking.id)
          .eq('customer_id', user.id);

        if (cancelErr) throw cancelErr;

        await notifyAdminsAndStaff(selectedBooking, 'customer_cancelled', finalReason);

        setConfirmNotice('✅ Cancelled. Admin & staff notified.');
        setSuccess('Booking cancelled successfully!');
      } else {
        // reschedule
        if (selectedBooking.staffId) {
          const ok = await isTimeSlotAvailable(
            rescheduleDate,
            rescheduleTime,
            String(selectedBooking.staffId),
            selectedBooking.id
          );

          if (!ok) {
            setRescheduleError('This time slot is no longer available. Please choose another time.');
            setConfirmNotice(null);
            setShowConfirmModal(false);
            openRescheduleModal();
            setLoading(false);
            return;
          }
        }

        const { error: resErr } = await supabase
          .from('bookings')
          .update({
            booking_date: rescheduleDate,
            booking_time: rescheduleTime,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedBooking.id)
          .eq('customer_id', user.id);

        if (resErr) throw resErr;

        await notifyAdminsAndStaff(
          selectedBooking,
          'customer_rescheduled',
          finalReason,
          rescheduleDate,
          rescheduleTime
        );

        setConfirmNotice('✅ Rescheduled. Admin & staff notified.');
        setSuccess('Booking rescheduled successfully! Status changed to pending for approval.');
      }

      // refresh bookings so UI shows new date/time/status
      await fetchCustomerBookings();

      // auto-close after quick notice
      setTimeout(() => {
        setShowConfirmModal(false);
        setSelectedBooking(null);
        setConfirmNotice(null);
        setActionType(null);
        setSelectedReason('');
        setCustomReason('');
        setFinalReason('');
      }, 1100);
    } catch (err: any) {
      console.error('Final action error:', err);
      setError(err?.message || 'Action failed. Please try again.');
      setConfirmNotice(null);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------- TABLE -----------------------------
  const columns = [
    {
      header: 'Service',
      key: 'serviceName',
      render: (item: BookingWithRelations) => item.service_name
    },
    {
      header: 'Date & Time',
      key: 'datetime',
      render: (item: BookingWithRelations) => formatDateTime(item.booking_date, item.booking_time)
    },
    {
      header: 'Staff',
      key: 'staffName',
      render: (item: BookingWithRelations) => item.staff_name || 'Unassigned'
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
      render: (item: BookingWithRelations) =>
        item.status === 'pending' || item.status === 'confirmed' ? (
          <div className="booking-actions-stacked">
            <Button variant="secondary" size="small" onClick={() => handleRescheduleClick(item)} className="action-button">
              Reschedule
            </Button>
            <Button variant="text" size="small" onClick={() => handleCancelClick(item)} className="cancel-button action-button">
              Cancel
            </Button>
          </div>
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>No actions available</span>
        )
    }
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="Manage Your Bookings" />

          {bookingsLoading ? (
            <div className="dashboard-loading">
              <p>Loading your bookings...</p>
            </div>
          ) : error ? (
            <div className="dashboard-error">{error}</div>
          ) : success ? (
            <div className="dashboard-success">{success}</div>
          ) : null}

          {bookings.length === 0 && !bookingsLoading ? (
            <div className="empty-booking-state">
              <p className="empty-message">You don't have any bookings yet.</p>
              <Button
                variant="primary"
                onClick={() => (window.location.href = '/customer/services')}
                className="book-first-button"
              >
                Book Your First Appointment
              </Button>
            </div>
          ) : (
            <div className="upcoming-bookings-section">
              <div className="section-header">
                <h2 className="section-title">Your Bookings ({bookings.length})</h2>
                <div className="section-actions">
                  <Button
                    variant="primary"
                    onClick={() => (window.location.href = '/customer/services')}
                    className="book-new-button"
                  >
                    Book New Appointment
                  </Button>
                </div>
              </div>

              <Table
                data={bookings}
                columns={columns}
                caption={`Showing ${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================= */}
      {/* RESCHEDULE MODAL (STEP 0) */}
      {/* ========================= */}
      <Modal isOpen={isRescheduleModalOpen} onClose={closeRescheduleModal} title="Reschedule Appointment">
        {selectedBooking && (
          <>
            <p className="modal-description">
              Reschedule <strong>{selectedBooking.service_name}</strong> currently on{' '}
              <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>.
            </p>

            <div className="reschedule-note">
              <strong>Note:</strong> After rescheduling, your booking status will change to <strong>pending</strong> and
              will require admin approval.
            </div>

            <form onSubmit={handleRescheduleNext} className="booking-form">
              <div className="form-group">
                <label htmlFor="reschedule-date">New Date *</label>
                <input
                  type="date"
                  id="reschedule-date"
                  className="form-input"
                  value={rescheduleDate}
                  onChange={(e) => handleRescheduleDateChange(e.target.value)}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reschedule-time">New Time *</label>
                <select
                  id="reschedule-time"
                  className="form-select"
                  value={rescheduleTime}
                  onChange={(e) => handleRescheduleTimeChange(e.target.value)}
                  required
                  disabled={!rescheduleDate}
                >
                  <option value="">-- {rescheduleDate ? 'Select a Time' : 'Select a date first'} --</option>
                  {getAvailableTimeSlots().map((time) => (
                    <option key={time} value={time}>
                      {parseInt(time.split(':')[0], 10) >= 12 ? `${time} PM` : `${time} AM`}
                    </option>
                  ))}
                </select>

                <small className="time-slot-note">
                  {rescheduleDate === new Date().toISOString().split('T')[0]
                    ? `Today's available time slots (current time: ${new Date()
                        .getHours()
                        .toString()
                        .padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')})`
                    : 'Business hours: 9:00 AM - 6:00 PM'}
                </small>

                {rescheduleDate && getAvailableTimeSlots().length === 0 && (
                  <small className="error-note">No available time slots for the selected date. Please choose another date.</small>
                )}
              </div>

              {rescheduleError && <div className="form-error">{rescheduleError}</div>}

              <div className="modal-actions">
                <Button variant="secondary" onClick={closeRescheduleModal} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  Next
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* ========================= */}
      {/* REASON MODAL (STEP 1)     */}
      {/* ========================= */}
      <Modal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        title={actionType === 'reschedule' ? 'Reason for Reschedule' : 'Reason for Cancellation'}
      >
        {selectedBooking && (
          <div className="contact-form reason-modal">
            <p style={{ marginBottom: 12, opacity: 0.85 }}>Please select a reason to proceed.</p>

            <div className="form-group">
              <label>Reason *</label>

              <div className="reason-options">
                {(actionType === 'reschedule' ? RESCHEDULE_REASONS : CANCELLATION_REASONS).map((r) => (
                  <label key={r} className="reason-option">
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={(e) => setSelectedReason(e.target.value)}
                    />
                    <span className="reason-text">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === 'Other (please specify)' && (
              <div className="form-group">
                <label>Custom Reason *</label>
                <textarea
                  rows={3}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Type the reason here..."
                />
              </div>
            )}

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReasonModal(false);
                  resetReasonFlow();
                }}
                disabled={loading}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                disabled={!selectedReason || (selectedReason === 'Other (please specify)' && !customReason.trim())}
                onClick={proceedToConfirm}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================= */}
      {/* CONFIRM MODAL (STEP 2)    */}
      {/* ========================= */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirm">
        {selectedBooking && (
          <>
            <p className="modal-description">
              {actionType === 'cancel' ? (
                <>
                  Confirm cancellation of <strong>{selectedBooking.service_name}</strong> on{' '}
                  <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>?
                </>
              ) : (
                <>
                  Confirm reschedule of <strong>{selectedBooking.service_name}</strong> to{' '}
                  <strong>{formatDateTime(rescheduleDate, rescheduleTime)}</strong>?
                </>
              )}
            </p>

            <p style={{ marginTop: 10 }}>
              <strong>Reason:</strong> {finalReason}
            </p>

            {confirmNotice && (
              <div className="dashboard-success" style={{ marginTop: 12 }}>
                {confirmNotice}
              </div>
            )}

            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowReasonModal(true);
                }}
                disabled={loading}
              >
                Back
              </Button>

              <Button variant="primary" onClick={executeFinalAction} disabled={loading}>
                {loading ? 'Submitting...' : 'Confirm'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CancelReschedule;
