// src/pages/customer/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { Link } from 'react-router-dom';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
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

const CustomerDashboard: React.FC = () => {
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

  // Fetch customer bookings from Supabase - Only pending and confirmed
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
        .in('status', ['pending', 'confirmed']) // Only fetch pending and confirmed bookings
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });

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
      await fetchCustomerBookings(); // Refresh the list
    } catch (err: any) {
      console.error('Cancellation error:', err);
      setError(err.message || 'Failed to cancel booking.');
    } finally {
      setLoading(false);
      closeCancelModal();
    }
  };

  const handleRescheduleClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setRescheduleDate(booking.booking_date || '');
    setRescheduleTime(booking.booking_time || '');
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

  // Get available time slots for rescheduling based on whether it's today or future date
  const getAvailableTimeSlots = () => {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Check if reschedule date is today
    const isToday = rescheduleDate === now.toISOString().split('T')[0];
    
    for (let hour = startHour; hour < endHour; hour++) {
      // For 00 minute slot
      if (!isToday || hour > currentHour || (hour === currentHour && currentMinute < 30)) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
      
      // For 30 minute slot (except for the last hour)
      if (hour < endHour - 1) {
        if (!isToday || hour > currentHour || (hour === currentHour && currentMinute <= 30)) {
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
    }
    
    return slots;
  };

  // Handle reschedule date change - reset time if needed
  const handleRescheduleDateChange = (date: string) => {
    setRescheduleDate(date);
    
    // If the selected time is no longer valid for the new date, reset it
    if (date && rescheduleTime) {
      const timeSlots = getAvailableTimeSlots();
      if (!timeSlots.includes(rescheduleTime)) {
        setRescheduleTime('');
      }
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !rescheduleDate || !rescheduleTime || !user) {
      setError('Please provide a new date and time.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (selectedBooking.staffId) {
        const isAvailable = await isTimeSlotAvailable(
          rescheduleDate, 
          rescheduleTime, 
          selectedBooking.staffId,
          selectedBooking.id
        );
        
        if (!isAvailable) {
          setError('This time slot is no longer available. Please choose another time.');
          setLoading(false);
          return;
        }
      }

      const updateData = {
        booking_date: rescheduleDate,
        booking_time: rescheduleTime,
        status: 'pending', // Change status to pending when rescheduled
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', selectedBooking.id)
        .eq('customer_id', user.id);

      if (error) throw error;

      setSuccess('Booking rescheduled successfully! Status changed to pending for approval.');
      await fetchCustomerBookings();
    } catch (err: any) {
      console.error('Reschedule error:', err);
      setError(err.message || 'Failed to reschedule booking.');
    } finally {
      setLoading(false);
      closeRescheduleModal();
    }
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';
    
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    if (!time) return formattedDate;
    
    // Parse the time and format it properly
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`;
  };

  // Since we're only fetching pending and confirmed bookings, all bookings are upcoming
  const upcomingBookings = bookings;

  const upcomingColumns = [
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
      render: (item: BookingWithRelations) => (
        <span className={`booking-status-badge booking-status-badge-${item.status}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => (
        <div className="booking-actions">
          <Button variant="secondary" size="small" onClick={() => handleRescheduleClick(item)}>
            Reschedule
          </Button>
          <Button 
            variant="text" 
            size="small" 
            onClick={() => handleCancelClick(item)} 
            className="cancel-button"
          >
            Cancel
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title={`Welcome, ${user?.first_name}!`} />
        
        <div className="dashboard-content-wrapper">
          {/* Error/Success Messages */}
          {error && (
            <div className="dashboard-error">
              {error}
            </div>
          )}
          
          {success && (
            <div className="dashboard-success">
              {success}
            </div>
          )}

          {/* Quick Stats */}
          <div className="stats-grid">
            <div className="stat-card upcoming-card">
              <h3 className="stat-number">{upcomingBookings.length}</h3>
              <p className="stat-label">Upcoming Appointments</p>
            </div>
            <div className="stat-card pending-card">
              <h3 className="stat-number">{upcomingBookings.filter(b => b.status === 'pending').length}</h3>
              <p className="stat-label">Pending</p>
            </div>
            <div className="stat-card confirmed-card">
              <h3 className="stat-number">{upcomingBookings.filter(b => b.status === 'confirmed').length}</h3>
              <p className="stat-label">Confirmed</p>
            </div>
          </div>

          {/* Upcoming Bookings Section */}
          <section className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Upcoming Bookings
              </h2>
              <div className="section-actions">
                <Link to="/customer/manage-bookings">
                  <Button variant="secondary" size="medium" className="view-all-button">
                    View All Bookings
                  </Button>
                </Link>
                <Link to="/customer/book">
                  <Button variant="primary" size="medium" className="book-new-button">
                    Book New Appointment
                  </Button>
                </Link>
              </div>
            </div>

            {bookingsLoading ? (
              <div className="dashboard-loading">
                <p>Loading your bookings...</p>
              </div>
            ) : upcomingBookings.length > 0 ? (
              <Table data={upcomingBookings} columns={upcomingColumns} />
            ) : (
              <div className="empty-booking-state">
                <p className="empty-message">
                  No upcoming bookings found.
                </p>
                <Link to="/customer/book">
                  <Button variant="primary" size="medium" className="book-first-button">
                    Book Your First Appointment
                  </Button>
                </Link>
              </div>
            )}
          </section>

          {/* Quick Actions */}
          <div className="quick-actions-grid">
            <Link to="/customer/book" className="quick-action-link">
              <div className="quick-action-card book-action-card">
                <h4 className="action-title">📅 Book New Appointment</h4>
                <p className="action-description">
                  Schedule a new beauty or wellness service
                </p>
              </div>
            </Link>
            
            <Link to="/customer/manage-bookings" className="quick-action-link">
              <div className="quick-action-card view-action-card">
                <h4 className="action-title">📊 View All Bookings</h4>
                <p className="action-description">
                  See your complete booking history
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={closeCancelModal} title="Confirm Cancellation">
        {selectedBooking && (
          <>
            <p>Are you sure you want to cancel your appointment for <strong>{selectedBooking.service_name}</strong> on <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>?</p>
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
            <form onSubmit={handleConfirmReschedule} className="contact-form">
              <div className="form-group">
                <label htmlFor="reschedule-date">New Date *</label>
                <input
                  type="date"
                  id="reschedule-date"
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
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  required
                  disabled={!rescheduleDate}
                >
                  <option value="">
                    {!rescheduleDate ? 'Select a date first' : 'Select a Time'}
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

              {error && (
                <div className="form-error">
                  {error}
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

export default CustomerDashboard;