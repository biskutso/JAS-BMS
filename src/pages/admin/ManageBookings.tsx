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

// Create a complete interface that includes all Booking properties
interface BookingWithRelations {
  // Base Booking properties
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
  
  // Additional relations
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

const ManageBookings: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [staffMembers, setStaffMembers] = useState<User[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [formData, setFormData] = useState<Partial<Booking & { bookingDate: string; bookingTime: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      // Transform the data to match our interface
      const bookingsWithRelations: BookingWithRelations[] = (data || []).map(booking => ({
        // Base Booking properties
        id: booking.id,
        serviceId: booking.service_id,
        serviceName: booking.services?.service_name || 'Unknown Service',
        customerId: booking.customer_id,
        customerName: `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim() || 'Unknown Customer',
        staffId: booking.staff_id,
        staffName: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
        startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
        endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '', // You might want to calculate this based on duration
        status: booking.status as BookingStatus,
        price: booking.total_price || booking.services?.price || 0,
        notes: booking.notes || '',
        
        // Additional relations
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
        .select('*')
        .eq('role', 'staff')
        .order('first_name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
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
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setLoading(true);
    setError(null);

    try {
      const updateData = {
        staff_id: formData.staffId === '' ? null : formData.staffId,
        booking_date: formData.bookingDate || selectedBooking.booking_date,
        booking_time: formData.bookingTime || selectedBooking.booking_time,
        status: formData.status || selectedBooking.status,
        notes: formData.notes || selectedBooking.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setSuccessMessage('Booking updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
      closeModal();
    } catch (err: any) {
      setError(`Failed to update booking: ${err.message}`);
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

      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      setSuccessMessage(`Booking status updated to ${newStatus}`);
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
      render: (item: BookingWithRelations) => {
        const isActive = isActiveBooking(item.status);
        
        return (
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            {isActive ? (
              // Active bookings (pending/confirmed) - show full actions
              <>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <Button variant="secondary" size="small" onClick={() => handleEditClick(item)}>
                    Edit
                  </Button>
                  <Button 
                    variant="text" 
                    size="small" 
                    onClick={() => handleDelete(item.id)} 
                    style={{ color: '#d32f2f' }}
                  >
                    Delete
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {item.status !== 'confirmed' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'confirmed')}
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    >
                      Confirm
                    </Button>
                  )}
                  {item.status !== 'completed' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'completed')}
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    >
                      Complete
                    </Button>
                  )}
                  {item.status !== 'cancelled' && (
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => handleStatusUpdate(item.id, 'cancelled')}
                      style={{ fontSize: '11px', padding: '2px 6px', color: '#d32f2f' }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            ) : (
              // Completed or cancelled bookings - only show delete
              <div style={{ display: 'flex', gap: '4px' }}>
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={() => handleDelete(item.id)} 
                  style={{ color: '#d32f2f' }}
                >
                  Delete
                </Button>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    color: '#666', 
                    fontStyle: 'italic',
                    padding: '4px 0'
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

  return (
    <>
      <DashboardHeader 
        title="Manage Bookings"
        actions={
          <Button variant="secondary" onClick={fetchBookings} disabled={loading}>
            Refresh Bookings
          </Button>
        }
      />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          View and manage all customer appointments, assign staff, and update statuses.
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
                onChange={handleChange}
                disabled={!isActiveBooking(selectedBooking.status)}
              >
                <option value="">Unassigned</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName}
                  </option>
                ))}
              </select>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify staff for completed or cancelled bookings
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="bookingDate">Booking Date</label>
              <input 
                type="date" 
                id="bookingDate" 
                name="bookingDate" 
                value={formData.bookingDate || ''} 
                onChange={handleChange}
                required 
                disabled={!isActiveBooking(selectedBooking.status)}
              />
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify date for completed or cancelled bookings
                </small>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="bookingTime">Booking Time</label>
              <select 
                id="bookingTime" 
                name="bookingTime" 
                value={formData.bookingTime || ''} 
                onChange={handleChange}
                required
                disabled={!isActiveBooking(selectedBooking.status)}
              >
                <option value="">Select a time</option>
                <option value="09:00">09:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="13:00">01:00 PM</option>
                <option value="14:00">02:00 PM</option>
                <option value="15:00">03:00 PM</option>
                <option value="16:00">04:00 PM</option>
                <option value="17:00">05:00 PM</option>
                <option value="18:00">06:00 PM</option>
              </select>
              {!isActiveBooking(selectedBooking.status) && (
                <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                  Cannot modify time for completed or cancelled bookings
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
            
            {error && <p className="auth-error-message">{error}</p>}
            
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