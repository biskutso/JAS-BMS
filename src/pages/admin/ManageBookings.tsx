// src/pages/admin/ManageBookings.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
import { User } from '@models/user';
import { supabase } from '../../supabaseClient';
import { SupabaseNotificationService } from '../../services/supabaseNotificationService'; // Add this import

// Create a complete interface that includes all Booking properties
interface BookingWithRelations {
  id: string;
  serviceId: string;
  serviceName: string;
  customerId: string;
  customerName: string;
  staffId?: string;
  staffName?: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  price: number;
  notes?: string;
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

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const ManageBookings: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [formData, setFormData] = useState<Partial<Booking & { bookingDate: string; bookingTime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notificationLoading, setNotificationLoading] = useState<string | null>(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Get max date (30 days from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  // Fetch all bookings with related data
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          staff:staff_id (first_name, last_name, email)
        `)
        .order('booking_date', { ascending: false });

      if (error) throw error;

      const bookingsWithRelations: BookingWithRelations[] = (data || []).map(booking => ({
        id: booking.id,
        serviceId: booking.service_id,
        serviceName: booking.services?.service_name || 'Unknown Service',
        customerId: booking.customer_id,
        customerName: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        staffId: booking.staff_id,
        staffName: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
        startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        status: booking.status as BookingStatus,
        price: booking.total_price || booking.services?.price || 0,
        notes: booking.notes || '',
        service_name: booking.services?.service_name || 'Unknown Service',
        service_price: booking.services?.price || 0,
        service_duration: booking.services?.duration || 60,
        customer_name: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        customer_email: booking.customers?.email || '',
        staff_name: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
        staff_email: booking.staff?.email || '',
        booking_date: booking.booking_date,
        booking_time: booking.booking_time
      }));

      setBookings(bookingsWithRelations);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(`Failed to load bookings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff members for assignment
  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role', 'staff')
        .order('first_name');

      if (error) throw error;
      
      setStaffMembers(data || []);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      setError(`Failed to load staff members: ${err.message}`);
    }
  };

  // Simple function to send notification directly to database
  const sendBookingNotification = async (
    booking: BookingWithRelations, 
    notificationType: 'reschedule_request' | 'cancellation_request'
  ) => {
    try {
      setNotificationLoading(booking.id);
      setError(null);

      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const formattedDate = bookingDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const formattedTime = bookingDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      const formattedDateTime = `${formattedDate} at ${formattedTime}`;

      const notificationData = {
        user_id: booking.customerId,
        booking_id: booking.id,
        type: notificationType,
        title: '',
        message: '',
        read: false,
        created_at: new Date().toISOString()
      };

      // Set notification content based on type
      switch (notificationType) {
        case 'reschedule_request':
          notificationData.title = '🔁 Action Required: Reschedule Your Appointment';
          notificationData.message = `Your booking for **${booking.service_name}** on **${formattedDateTime}** needs to be rescheduled. 

Please choose a new date and time that works for you.

If you have any questions, please contact our support team.`;
          break;
          
        case 'cancellation_request':
          notificationData.title = '⚠️ Action Required: Confirm Cancellation';
          notificationData.message = `Your booking for **${booking.service_name}** on **${formattedDateTime}** cannot be confirmed as scheduled.

Please this booking or contact our support team to discuss alternative options.

We apologize for any inconvenience.`;
          break;
      }

      // Insert the notification directly into the database
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationData]);

      if (notificationError) throw notificationError;

      // Update booking's updated_at timestamp
      await supabase
        .from('bookings')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);

      return true;
    } catch (err: any) {
      console.error('Error sending notification:', err);
      throw err;
    } finally {
      setNotificationLoading(null);
    }
  };

  // Manual function to request customer to reschedule
  const requestCustomerReschedule = async (booking: BookingWithRelations) => {
    try {
      await sendBookingNotification(booking, 'reschedule_request');
      setSuccessMessage(`✅ ${booking.customer_name} has been notified to reschedule their ${booking.service_name} appointment.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(`Failed to request reschedule: ${err.message}`);
    }
  };

  // Manual function to request customer cancellation
  const requestCustomerCancellation = async (booking: BookingWithRelations) => {
    try {
      await sendBookingNotification(booking, 'cancellation_request');
      setSuccessMessage(`✅ ${booking.customer_name} has been notified to cancel their ${booking.service_name} appointment.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(`Failed to request cancellation: ${err.message}`);
    }
  };

  // ✅ NEW: Send automatic notifications when status changes to confirmed or completed
  const sendAutomaticNotification = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      console.log(`🔄 Sending automatic notification for booking ${bookingId}, status: ${newStatus}`);
      
      if (newStatus === 'confirmed') {
        await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_confirmed');
        console.log('✅ Confirmation notification sent');
      } else if (newStatus === 'completed') {
        await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_completed');
        console.log('✅ Completion notification sent');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error sending automatic notification:', error);
      // Don't throw the error - we don't want to break the booking update
      return false;
    }
  };

  // Get available time slots based on whether it's today or future date
  const getAvailableTimeSlots = (selectedDate: string) => {
    const slots = [];
    const startHour = 9;
    const endHour = 18;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const isToday = selectedDate === getTodayDate();
    
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

  // Check if a time slot is available for the selected staff
  const isTimeSlotAvailable = async (date: string, time: string, staffId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('staff_id', staffId)
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;

      return data.length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true;
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchStaffMembers();
  }, []);

  const handleEditClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setFormData({
      ...booking,
      bookingDate: booking.booking_date ? new Date(booking.booking_date).toISOString().split('T')[0] : '',
      bookingTime: booking.booking_time || '',
      staffId: booking.staffId || ''
    });
    setModalError(null);
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setModalError(null);
  };

  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, bookingDate: date, bookingTime: '' }));
    setModalError(null);
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const staffId = e.target.value;
    setFormData(prev => ({ ...prev, staffId, bookingTime: '' }));
    setModalError(null);
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setLoading(true);
    setError(null);
    setModalError(null);

    try {
      const today = getTodayDate();
      if (formData.bookingDate && formData.bookingDate < today) {
        setModalError('Cannot book appointments in the past. Please select today or a future date.');
        setLoading(false);
        return;
      }

      if (formData.bookingDate && formData.bookingTime && formData.staffId) {
        const isAvailable = await isTimeSlotAvailable(
          formData.bookingDate, 
          formData.bookingTime, 
          formData.staffId
        );
        
        if (!isAvailable) {
          setModalError('This time slot is no longer available for the selected staff member. Please choose another time or staff member.');
          setLoading(false);
          return;
        }
      }

      const newStatus = formData.status || selectedBooking.status;
      const updateData = {
        staff_id: formData.staffId === '' ? null : formData.staffId,
        booking_date: formData.bookingDate || selectedBooking.booking_date,
        booking_time: formData.bookingTime || selectedBooking.booking_time,
        status: newStatus,
        notes: formData.notes || selectedBooking.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', selectedBooking.id);

      if (error) throw error;

      // ✅ NEW: Send automatic notification if status changed to confirmed or completed
      const statusChanged = newStatus !== selectedBooking.status;
      let notificationSent = false;
      
      if (statusChanged && (newStatus === 'confirmed' || newStatus === 'completed')) {
        try {
          await sendAutomaticNotification(selectedBooking.id, newStatus);
          notificationSent = true;
        } catch (notificationError) {
          console.error('Notification failed, but booking was updated:', notificationError);
          // Continue even if notification fails
        }
      }

      const successMsg = notificationSent 
        ? `Booking updated successfully! Customer notified about ${newStatus} status.`
        : 'Booking updated successfully';

      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
      closeModal();
    } catch (err: any) {
      setModalError(`Failed to update booking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      setSuccessMessage('Booking deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
    } catch (err: any) {
      setError(`Failed to delete booking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      setLoading(true);
      setError(null);

      // Get the current booking to check if status is changing
      const currentBooking = bookings.find(b => b.id === bookingId);
      const statusChanged = currentBooking && currentBooking.status !== newStatus;

      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      // ✅ NEW: Send automatic notification if status changed to confirmed or completed
      let notificationSent = false;
      if (statusChanged && (newStatus === 'confirmed' || newStatus === 'completed')) {
        try {
          await sendAutomaticNotification(bookingId, newStatus);
          notificationSent = true;
        } catch (notificationError) {
          console.error('Notification failed, but booking was updated:', notificationError);
          // Continue even if notification fails
        }
      }

      const successMsg = notificationSent 
        ? `Booking status updated to ${newStatus}! Customer notified.`
        : `Booking status updated to ${newStatus}`;

      setSuccessMessage(successMsg);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
    } catch (err: any) {
      setError(`Failed to update status: ${err.message}`);
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

  // Helper function to determine if booking is active (can be edited)
  const isActiveBooking = (status: BookingStatus) => {
    return status === 'pending' || status === 'confirmed';
  };

  const columns = [
    { 
      header: 'Service', 
      key: 'service', 
      render: (item: BookingWithRelations) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{item.service_name}</div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {formatCurrency(item.service_price)} • {item.service_duration}min
          </div>
        </div>
      )
    },
    { 
      header: 'Customer', 
      key: 'customer', 
      render: (item: BookingWithRelations) => (
        <div>
          <div>{item.customer_name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{item.customer_email}</div>
        </div>
      )
    },
    { 
      header: 'Staff', 
      key: 'staff', 
      render: (item: BookingWithRelations) => (
        <div>
          <div>{item.staff_name}</div>
          {item.staff_email && (
            <div style={{ fontSize: '12px', color: '#666' }}>{item.staff_email}</div>
          )}
        </div>
      )
    },
    { 
      header: 'Date & Time', 
      key: 'datetime', 
      render: (item: BookingWithRelations) => (
        <div>
          <div>{formatDateTime(item.booking_date, item.booking_time)}</div>
          {item.booking_time && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {item.booking_time}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Status', 
      key: 'status', 
      render: (item: BookingWithRelations) => (
        <div>
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
        </div>
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => {
        const isActive = isActiveBooking(item.status);
        const isNotificationLoading = notificationLoading === item.id;
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
            {isActive ? (
              <>
                {/* Primary Actions */}
                <div style={{ 
                  display: 'flex', 
                  gap: '6px', 
                  padding: '6px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  <Button 
                    variant="secondary" 
                    size="small" 
                    onClick={() => handleEditClick(item)}
                    style={{ flex: 1 }}
                  >
                    ✏️ Edit
                  </Button>
                  <Button 
                    variant="text" 
                    size="small" 
                    onClick={() => handleDelete(item.id)} 
                    style={{ 
                      color: '#d32f2f',
                      minWidth: 'auto'
                    }}
                    title="Delete booking"
                  >
                    🗑️
                  </Button>
                </div>

                {/* Status Actions */}
                <div style={{ 
                  display: 'flex', 
                  gap: '4px', 
                  flexWrap: 'wrap',
                  padding: '6px',
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px',
                  border: '1px solid #e9ecef'
                }}>
                  {item.status !== 'confirmed' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'confirmed')}
                      style={{ 
                        fontSize: '11px', 
                        padding: '4px 8px',
                        backgroundColor: '#e8f5e8',
                        border: '1px solid #c8e6c9',
                        color: '#2e7d32'
                      }}
                    >
                      ✓ Confirm
                    </Button>
                  )}
                  {item.status !== 'completed' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'completed')}
                      style={{ 
                        fontSize: '11px', 
                        padding: '4px 8px',
                        backgroundColor: '#e3f2fd',
                        border: '1px solid #bbdefb',
                        color: '#1565c0'
                      }}
                    >
                      ✓ Complete
                    </Button>
                  )}
                  {item.status !== 'cancelled' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'cancelled')}
                      style={{ 
                        fontSize: '11px', 
                        padding: '4px 8px',
                        backgroundColor: '#ffebee',
                        border: '1px solid #ffcdd2',
                        color: '#c62828'
                      }}
                    >
                      ✗ Cancel
                    </Button>
                  )}
                </div>

                {/* Customer Notification Actions */}
                <div style={{ 
                  display: 'flex', 
                  gap: '6px',
                  padding: '8px',
                  backgroundColor: '#fff3e0',
                  borderRadius: '6px',
                  border: '1px solid #ffe0b2'
                }}>
                  <Button 
                    variant="text" 
                    size="small" 
                    onClick={() => requestCustomerReschedule(item)}
                    disabled={isNotificationLoading}
                    style={{ 
                      fontSize: '11px', 
                      padding: '6px 8px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #bbdefb',
                      color: '#1976d2',
                      flex: 1,
                      opacity: isNotificationLoading ? 0.6 : 1
                    }}
                  >
                    {isNotificationLoading ? '⏳ Sending...' : '🔄 Reschedule'}
                  </Button>
                  <Button 
                    variant="text" 
                    size="small" 
                    onClick={() => requestCustomerCancellation(item)}
                    disabled={isNotificationLoading}
                    style={{ 
                      fontSize: '11px', 
                      padding: '6px 8px',
                      backgroundColor: '#ffebee',
                      border: '1px solid #ffcdd2',
                      color: '#d32f2f',
                      flex: 1,
                      opacity: isNotificationLoading ? 0.6 : 1
                    }}
                  >
                    {isNotificationLoading ? '⏳ Sending...' : '⚠️ Cancel'}
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                alignItems: 'center',
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px',
                border: '1px solid #e0e0e0'
              }}>
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={() => handleDelete(item.id)} 
                  style={{ 
                    color: '#d32f2f',
                    fontSize: '11px',
                    padding: '4px 8px'
                  }}
                >
                  🗑️ Delete
                </Button>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    color: '#666', 
                    fontStyle: 'italic',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Read-only
                </span>
              </div>
            )}
          </div>
        );
      }
    },
  ];

  // Get available time slots for the selected date
  const availableTimeSlots = formData.bookingDate ? getAvailableTimeSlots(formData.bookingDate) : [];

  return (
    <>
      <DashboardHeader 
        title="Manage Bookings"
        actions={
          <Button variant="secondary" onClick={fetchBookings} disabled={loading}>
            🔄 Refresh Bookings
          </Button>
        }
      />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          View and manage all customer appointments, assign staff, and update statuses.
          <br />
          <small style={{ color: '#666', fontSize: '14px' }}>
            Use the notification buttons to manually send requests to customers when needed.
          </small>
        </p>
        
        {successMessage && (
          <div style={{
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #c8e6c9'
          }}>
            {successMessage}
          </div>
        )}
        
        {loading && !isOpen && <p style={{textAlign: 'center'}}>Loading bookings...</p>}
        {error && (
          <div className="auth-error-message" style={{textAlign: 'left', whiteSpace: 'pre-wrap'}}>
            {error}
          </div>
        )}
        
        <Table 
          data={bookings} 
          columns={columns} 
          caption={`Bookings (${bookings.length})`}
          emptyMessage="No bookings found. Bookings will appear here when customers make appointments."
        />
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} title="Edit Booking">
        {selectedBooking && (
          <form onSubmit={handleUpdateBooking} className="contact-form">
            <div className="form-group">
              <label htmlFor="serviceName">Service</label>
              <input 
                type="text" 
                id="serviceName" 
                name="serviceName" 
                value={selectedBooking.service_name || ''} 
                disabled 
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="servicePrice">Price</label>
              <input 
                type="text" 
                id="servicePrice" 
                name="servicePrice" 
                value={formatCurrency(selectedBooking.service_price || 0)} 
                disabled 
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="customerName">Customer</label>
              <input 
                type="text" 
                id="customerName" 
                name="customerName" 
                value={selectedBooking.customer_name || ''} 
                disabled 
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="staffId">Assign Staff</label>
              <select 
                id="staffId" 
                name="staffId" 
                value={formData.staffId || ''} 
                onChange={handleStaffChange}
                disabled={!isActiveBooking(selectedBooking.status)}
              >
                <option value="">Unassigned</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name} {staff.last_name}
                  </option>
                ))}
              </select>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify staff for completed or cancelled bookings
                </small>
              )}
              {staffMembers.length === 0 && (
                <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                  No staff members found. Please add staff members first.
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="bookingDate">Booking Date *</label>
              <input 
                type="date" 
                id="bookingDate" 
                name="bookingDate" 
                value={formData.bookingDate || ''} 
                onChange={(e) => handleDateChange(e.target.value)}
                required 
                disabled={!isActiveBooking(selectedBooking.status)}
                min={getTodayDate()}
                max={getMaxDate()}
              />
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify date for completed or cancelled bookings
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="bookingTime">Booking Time *</label>
              <select 
                id="bookingTime" 
                name="bookingTime" 
                value={formData.bookingTime || ''} 
                onChange={handleChange}
                required
                disabled={!isActiveBooking(selectedBooking.status) || !formData.bookingDate}
              >
                <option value="">
                  {!formData.bookingDate 
                    ? 'Select a date first' 
                    : availableTimeSlots.length === 0 
                    ? 'No available time slots'
                    : 'Select a time'
                  }
                </option>
                {availableTimeSlots.map(time => (
                  <option key={time} value={time}>
                    {parseInt(time.split(':')[0]) >= 12 
                      ? `${time} PM` 
                      : `${time} AM`
                    }
                  </option>
                ))}
              </select>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify time for completed or cancelled bookings
                </small>
              )}
              {formData.bookingDate && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  {formData.bookingDate === getTodayDate() 
                    ? `Today's available time slots (current time: ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')})`
                    : 'Business hours: 9:00 AM - 6:00 PM'
                  }
                </small>
              )}
              {formData.bookingDate && availableTimeSlots.length === 0 && (
                <small style={{ color: '#d32f2f', marginTop: '4px', display: 'block' }}>
                  No available time slots for the selected date. Please choose another date.
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select 
                id="status" 
                name="status" 
                value={formData.status || ''} 
                onChange={handleChange}
                required
                disabled={!isActiveBooking(selectedBooking.status)}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify status for completed or cancelled bookings
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea 
                id="notes" 
                name="notes" 
                value={formData.notes || ''} 
                onChange={handleChange} 
                rows={3}
                placeholder="Add any notes about this booking..."
                disabled={!isActiveBooking(selectedBooking.status)}
              ></textarea>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify notes for completed or cancelled bookings
                </small>
              )}
            </div>
            
            {modalError && (
              <div style={{
                backgroundColor: '#fee',
                border: '1px solid #f5c6cb',
                color: '#721c24',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                {modalError}
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 'var(--spacing-md)', 
              marginTop: 'var(--spacing-lg)' 
            }}>
              <Button variant="secondary" onClick={closeModal} disabled={loading}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={loading || !isActiveBooking(selectedBooking.status)}
              >
                {loading ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>

            {!isActiveBooking(selectedBooking.status) && (
              <div style={{
                backgroundColor: '#fff3e0',
                border: '1px solid #ffb74d',
                color: '#f57c00',
                padding: '12px',
                borderRadius: '4px',
                marginTop: '16px',
                textAlign: 'center'
              }}>
                <strong>Read-only Mode:</strong> This booking is {selectedBooking.status} and cannot be modified.
              </div>
            )}
          </form>
        )}
      </Modal>
    </>
  );
};

export default ManageBookings;