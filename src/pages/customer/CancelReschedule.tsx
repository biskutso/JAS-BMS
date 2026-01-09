// src/pages/customer/CancelReschedule.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
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

const CancelReschedule: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const { isOpen: isCancelModalOpen, openModal: openCancelModal, closeModal: closeCancelModal } = useModal();
  const { isOpen: isRescheduleModalOpen, openModal: openRescheduleModal, closeModal: closeRescheduleModal } = useModal();
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Fetch customer bookings from Supabase
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
        .select(`
          *,
          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          staff:staff_id (first_name, last_name, email)
        `)
        .eq('customer_id', user.id)
        .order('booking_date', { ascending: false });

      if (error) throw error;

      // Transform data to match our interface
      const customerBookings: BookingWithRelations[] = (data || []).map(booking => ({
        id: booking.id,
        serviceId: booking.service_id,
        serviceName: booking.services?.service_name || 'Unknown Service',
        service_name: booking.services?.service_name || 'Unknown Service',
        service_price: booking.services?.price || 0,
        service_duration: booking.services?.duration || 60,
        customerId: booking.customer_id,
        customerName: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        customer_name: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        customer_email: booking.customers?.email || '',
        staffId: booking.staff_id,
        staffName: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
        staff_name: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
        staff_email: booking.staff?.email || '',
        startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        status: booking.status as BookingStatus,
        price: booking.total_price || booking.services?.price || 0,
        notes: booking.notes || ''
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

  const handleCancelClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    openCancelModal();
  };

  const handleConfirmCancel = async () => {
    if (!selectedBooking || !user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBooking.id)
        .eq('customer_id', user.id);

      if (error) throw error;

      setSuccess('Booking cancelled successfully!');
      await fetchCustomerBookings();
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError('Failed to cancel booking. Please try again.');
    } finally {
      setLoading(false);
      closeCancelModal();
    }
  };

  const handleRescheduleClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setRescheduleDate(booking.booking_date || '');
    setRescheduleTime(booking.booking_time || '');
    setRescheduleError(null);
    openRescheduleModal();
  };

  // Check if a time slot is available for rescheduling
  const isTimeSlotAvailable = async (date: string, time: string, staffId: string, excludeBookingId?: string): Promise<boolean> => {
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('staff_id', staffId)
        .in('status', ['pending', 'confirmed']);

      if (excludeBookingId) {
        query = query.neq('id', excludeBookingId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true;
    }
  };

  // Get available time slots for rescheduling
  const getAvailableTimeSlots = () => {
    const slots = [];
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
      if (!timeSlots.includes(rescheduleTime)) {
        setRescheduleTime('');
      }
    }
  };

  const handleRescheduleTimeChange = (time: string) => {
    setRescheduleTime(time);
    setRescheduleError(null);
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !rescheduleDate || !rescheduleTime || !user) {
      setRescheduleError('Please provide a new date and time.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setRescheduleError(null);

    try {
      // Check if the new time slot is available
      if (selectedBooking.staffId) {
        const isAvailable = await isTimeSlotAvailable(
          rescheduleDate, 
          rescheduleTime, 
          selectedBooking.staffId,
          selectedBooking.id
        );
        
        if (!isAvailable) {
          setRescheduleError('This time slot is no longer available. Please choose another time.');
          setLoading(false);
          return;
        }
      }

      // Update booking in Supabase
      const { data, error } = await supabase
        .from('bookings')
        .update({ 
          booking_date: rescheduleDate,
          booking_time: rescheduleTime,
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBooking.id)
        .eq('customer_id', user.id)
        .select();

      if (error) throw error;

      if (data && data.length === 0) {
        throw new Error('No records were updated. Please try again.');
      }

      setSuccess('Booking rescheduled successfully! Status changed to pending for approval.');
      await fetchCustomerBookings();
      
      // Close modal and reset only on success
      closeRescheduleModal();
      setRescheduleDate('');
      setRescheduleTime('');
      setSelectedBooking(null);
      
    } catch (err: any) {
      console.error('Reschedule error:', err);
      setRescheduleError('Failed to reschedule booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';
    
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString();
    
    if (!time) return formattedDate;
    
    return `${formattedDate} at ${time}`;
  };

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
        const statusClass = item.status === 'confirmed' ? 'booking-status-badge-confirmed' :
                           item.status === 'completed' ? 'booking-status-badge-completed' :
                           item.status === 'cancelled' ? 'booking-status-badge-cancelled' : 'booking-status-badge-pending';
        
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
        (item.status === 'pending' || item.status === 'confirmed') ? (
          <div className="booking-actions-stacked">
            <Button 
              variant="secondary" 
              size="small" 
              onClick={() => handleRescheduleClick(item)}
              className="action-button"
            >
              Reschedule
            </Button>
            <Button 
              variant="text" 
              size="small" 
              onClick={() => handleCancelClick(item)} 
              className="cancel-button action-button"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <span style={{ color: '#999', fontStyle: 'italic' }}>No actions available</span>
        )
      )
    },
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
                onClick={() => window.location.href = '/customer/services'}
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
                    onClick={() => window.location.href = '/customer/services'}
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

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={closeCancelModal} title="Confirm Cancellation">
        {selectedBooking && (
          <>
            <p className="modal-description">
              Are you sure you want to cancel your appointment for <strong>{selectedBooking.service_name}</strong> on <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>?
            </p>
            <p className="modal-note">
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={closeCancelModal} disabled={loading}>
                No, Keep It
              </Button>
              <Button variant="primary" onClick={handleConfirmCancel} disabled={loading}>
                {loading ? 'Cancelling...' : 'Yes, Cancel'}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal isOpen={isRescheduleModalOpen} onClose={closeRescheduleModal} title="Reschedule Appointment">
        {selectedBooking && (
          <>
            <p className="modal-description">
              Reschedule <strong>{selectedBooking.service_name}</strong> currently on <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>.
            </p>
            <div className="reschedule-note">
              <strong>Note:</strong> After rescheduling, your booking status will change to <strong>pending</strong> and will require admin approval.
            </div>
            <form onSubmit={handleConfirmReschedule} className="booking-form">
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
                  <option value="">
                    -- {rescheduleDate ? 'Select a Time' : 'Select a date first'} --
                  </option>
                  {getAvailableTimeSlots().map(time => (
                    <option key={time} value={time}>
                      {parseInt(time.split(':')[0]) >= 12 
                        ? `${time} PM` 
                        : `${time} AM`
                      }
                    </option>
                  ))}
                </select>
                <small className="time-slot-note">
                  {rescheduleDate === new Date().toISOString().split('T')[0] 
                    ? `Today's available time slots (current time: ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')})`
                    : 'Business hours: 9:00 AM - 6:00 PM'
                  }
                </small>
                {rescheduleDate && getAvailableTimeSlots().length === 0 && (
                  <small className="error-note">
                    No available time slots for the selected date. Please choose another date.
                  </small>
                )}
              </div>

              {rescheduleError && (
                <div className="form-error">
                  {rescheduleError}
                </div>
              )}

              <div className="modal-actions">
                <Button variant="secondary" onClick={closeRescheduleModal} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default CancelReschedule;