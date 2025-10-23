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
        .eq('customer_id', user.id); // Ensure customer can only cancel their own bookings

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
    // Pre-fill reschedule form with current date/time
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

      // Exclude the current booking if rescheduling
      if (excludeBookingId) {
        query = query.neq('id', excludeBookingId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If no bookings found at this time for this staff, it's available
      return data.length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true; // Default to available if check fails
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
      // Check if the new time slot is available
      if (selectedBooking.staffId) {
        const isAvailable = await isTimeSlotAvailable(
          rescheduleDate, 
          rescheduleTime, 
          selectedBooking.staffId,
          selectedBooking.id // Exclude current booking
        );
        
        if (!isAvailable) {
          setError('This time slot is no longer available. Please choose another time.');
          setLoading(false);
          return;
        }
      }

      // Update booking in Supabase
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
        .eq('customer_id', user.id); // Ensure customer can only update their own bookings

      if (error) throw error;

      setSuccess('Booking rescheduled successfully! Status changed to pending for admin approval.');
      await fetchCustomerBookings(); // Refresh the list
    } catch (err: any) {
      console.error('Reschedule error:', err);
      setError(err.message || 'Failed to reschedule booking.');
    } finally {
      setLoading(false);
      closeRescheduleModal();
    }
  };

  // Get available time slots for rescheduling
  const getAvailableTimeSlots = () => {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < endHour - 1) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
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
      render: (item: BookingWithRelations) => (
        <span style={{ 
          padding: '4px 8px', 
          borderRadius: '12px', 
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundColor: 
            item.status === 'confirmed' ? '#e8f5e8' :
            item.status === 'completed' ? '#e3f2fd' :
            item.status === 'cancelled' ? '#ffebee' : '#fff3e0',
          color: 
            item.status === 'confirmed' ? '#2e7d32' :
            item.status === 'completed' ? '#1565c0' :
            item.status === 'cancelled' ? '#c62828' : '#f57c00'
        }}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => (
        (item.status === 'pending' || item.status === 'confirmed') ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="small" onClick={() => handleRescheduleClick(item)}>
              Reschedule
            </Button>
            <Button 
              variant="text" 
              size="small" 
              onClick={() => handleCancelClick(item)} 
              style={{ color: '#d32f2f' }}
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
    <>
      <DashboardHeader title="Manage Your Bookings" />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          View your upcoming and past appointments. You can reschedule or cancel active bookings.
        </p>
        
        {bookingsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading your bookings...</p>
          </div>
        ) : error ? (
          <div className="auth-error-message" style={{textAlign: 'center'}}>{error}</div>
        ) : success ? (
          <div style={{
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #c8e6c9',
            textAlign: 'center'
          }}>
            {success}
          </div>
        ) : null}
        
        {bookings.length === 0 && !bookingsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>You don't have any bookings yet.</p>
            <Button 
              variant="primary" 
              onClick={() => window.location.href = '/customer/book-appointment'}
              style={{ marginTop: '10px' }}
            >
              Book Your First Appointment
            </Button>
          </div>
        ) : (
          <Table 
            data={bookings} 
            columns={columns} 
            caption={`Your Bookings (${bookings.length})`}
          />
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={closeCancelModal} title="Confirm Cancellation">
        {selectedBooking && (
          <>
            <p>Are you sure you want to cancel your appointment for <strong>{selectedBooking.service_name}</strong> on <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>?</p>
            <p style={{ color: '#666', fontSize: '14px' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
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
            <p style={{marginBottom: 'var(--spacing-md)'}}>
              Reschedule <strong>{selectedBooking.service_name}</strong> currently on <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>.
            </p>
            <form onSubmit={handleConfirmReschedule} className="contact-form">
              <div className="form-group">
                <label htmlFor="reschedule-date">New Date *</label>
                <input
                  type="date"
                  id="reschedule-date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
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
                >
                  <option value="">Select a time</option>
                  {getAvailableTimeSlots().map(time => (
                    <option key={time} value={time}>
                      {parseInt(time.split(':')[0]) >= 12 
                        ? `${time} PM` 
                        : `${time} AM`
                      }
                    </option>
                  ))}
                </select>
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Business hours: 9:00 AM - 6:00 PM
                </small>
              </div>

              {error && (
                <div style={{
                  backgroundColor: '#fee',
                  border: '1px solid #f5c6cb',
                  color: '#721c24',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: 'var(--spacing-md)', 
                marginTop: 'var(--spacing-lg)' 
              }}>
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
    </>
  );
};

export default CancelReschedule;