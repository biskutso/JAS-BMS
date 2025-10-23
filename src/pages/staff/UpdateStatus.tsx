// src/pages/staff/UpdateStatus.tsx
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
  customer_phone: string;
  staff_name: string;
  booking_date: string;
  booking_time: string;
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

  // Fetch staff bookings from Supabase
  const fetchStaffBookings = async () => {
    try {
      setBookingsLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your appointments.');
        return;
      }

      console.log('🔄 Fetching bookings for staff:', user.id);

      // Simple query to get bookings for this staff member
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', user.id)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });

      if (error) {
        console.error('❌ Error fetching staff bookings:', error);
        throw error;
      }

      console.log('✅ Staff bookings fetched:', data);

      // If we have bookings, fetch related data
      if (data && data.length > 0) {
        // Fetch service details
        const serviceIds = [...new Set(data.map(booking => booking.service_id))];
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        // Fetch customer details
        const customerIds = [...new Set(data.map(booking => booking.customer_id))];
        const { data: customersData } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, phone')
          .in('id', customerIds);

        // Transform data
        const staffBookings: BookingWithRelations[] = data.map(booking => {
          const service = servicesData?.find(s => s.id === booking.service_id);
          const customer = customersData?.find(c => c.id === booking.customer_id);
          
          return {
            id: booking.id,
            serviceId: booking.service_id,
            serviceName: service?.service_name || 'Unknown Service',
            service_name: service?.service_name || 'Unknown Service',
            service_price: service?.price || 0,
            service_duration: service?.duration || 60,
            customerId: booking.customer_id,
            customerName: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Unknown Customer',
            customer_name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Unknown Customer',
            customer_email: customer?.email || '',
            customer_phone: customer?.phone || '',
            staffId: booking.staff_id,
            staffName: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Current User',
            staff_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Current User',
            startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
            endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status as BookingStatus,
            price: booking.total_price || service?.price || 0,
            notes: booking.notes || ''
          };
        });

        setBookings(staffBookings);
      } else {
        setBookings([]);
      }

    } catch (err: any) {
      console.error('❌ Error fetching staff bookings:', err);
      setError('Failed to load your appointments. Please try again.');
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookings();
  }, [user]);

  const handleUpdateClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setNewStatus(booking.status);
    openModal();
  };

  const handleConfirmUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking || !newStatus || !user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Update booking status in Supabase
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBooking.id)
        .eq('staff_id', user.id); // Ensure staff can only update their own bookings

      if (error) throw error;

      setSuccess(`Booking status updated to ${newStatus} successfully!`);
      
      // Refresh the bookings list
      await fetchStaffBookings();
      
      // Close modal after a short delay
      setTimeout(() => {
        closeModal();
      }, 2000);
    } catch (err: any) {
      console.error('❌ Status update error:', err);
      setError(err.message || 'Failed to update booking status.');
    } finally {
      setLoading(false);
    }
  };

  // Format date and time for display
  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';
    
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString();
    
    if (!time) return formattedDate;
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`;
  };

  // Get status options based on current status
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
        options.push(
          { value: 'confirmed', label: 'Re-open', description: 'Re-open this completed appointment' }
        );
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
      key: 'serviceName',
      render: (item: BookingWithRelations) => item.service_name
    },
    { 
      header: 'Customer', 
      key: 'customerName',
      render: (item: BookingWithRelations) => (
        <div>
          <div style={{ fontWeight: '500' }}>{item.customer_name}</div>
          {item.customer_phone && (
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              📞 {item.customer_phone}
            </div>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                style={{ 
                  fontSize: '12px',
                  ...(option.value === 'cancelled' ? { color: '#d32f2f' } : {})
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : (
          <span style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>
            No actions available
          </span>
        );
      }
    },
  ];

  // Filter bookings to show only active ones (not completed or cancelled)
  const activeBookings = bookings.filter(booking => 
    booking.status === 'pending' || booking.status === 'confirmed'
  );

  const allBookings = bookings;

  return (
    <>
      <DashboardHeader title="Manage Appointments" />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Confirm, complete, or cancel customer appointments assigned to you.
        </p>

        {/* Error/Success Messages */}
        {error && (
          <div style={{
            backgroundColor: '#fee',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
        
        {success && (
          <div style={{
            backgroundColor: '#e8f5e8',
            border: '1px solid #c8e6c9',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {success}
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#fff3e0',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #ffb74d'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f57c00' }}>
              {bookings.filter(b => b.status === 'pending').length}
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Pending</p>
          </div>
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#e8f5e8',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #81c784'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#2e7d32' }}>
              {bookings.filter(b => b.status === 'confirmed').length}
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Confirmed</p>
          </div>
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#e3f2fd',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #64b5f6'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1565c0' }}>
              {bookings.filter(b => b.status === 'completed').length}
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Completed</p>
          </div>
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#f5f5f5',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #e0e0e0'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>
              {bookings.length}
            </h3>
            <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>Total</p>
          </div>
        </div>

        {/* Active Appointments Section */}
        <section style={{ marginBottom: 'var(--spacing-xl)' }}>
          <h3 style={{ 
            marginBottom: 'var(--spacing-md)', 
            fontSize: '1.5rem', 
            fontFamily: 'var(--font-family-serif)',
            color: 'var(--text-primary)'
          }}>
            Active Appointments ({activeBookings.length})
          </h3>
          
          {bookingsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading your appointments...</p>
            </div>
          ) : activeBookings.length > 0 ? (
            <Table data={activeBookings} columns={columns} />
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              backgroundColor: '#f9f9f9',
              borderRadius: 'var(--border-radius)',
              border: '1px solid #e0e0e0'
            }}>
              <p style={{ color: '#666', marginBottom: 'var(--spacing-md)' }}>
                No active appointments requiring action.
              </p>
              <p style={{ color: '#999', fontSize: '0.875rem' }}>
                When customers book appointments with you, they will appear here for you to confirm or manage.
              </p>
            </div>
          )}
        </section>

        {/* All Appointments Section */}
        {allBookings.length > 0 && (
          <section>
            <details style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)' }}>
              <summary style={{ 
                padding: 'var(--spacing-md) var(--spacing-lg)',
                cursor: 'pointer',
                fontSize: '1.5rem',
                fontFamily: 'var(--font-family-serif)',
                color: 'var(--text-primary)',
                listStyle: 'none',
                backgroundColor: 'var(--gray-50)'
              }}>
                All Appointments ({allBookings.length})
                <span style={{ float: 'right', fontSize: '1rem' }}>▼</span>
              </summary>
              <div style={{ padding: 'var(--spacing-md) 0' }}>
                <Table data={allBookings} columns={columns} />
              </div>
            </details>
          </section>
        )}
      </div>

      {/* Update Status Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Update Appointment Status">
        {selectedBooking && (
          <>
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              <p style={{ marginBottom: '8px' }}>
                Updating status for <strong>{selectedBooking.service_name}</strong>
              </p>
              <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                Customer: <strong>{selectedBooking.customer_name}</strong>
              </p>
              <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                Date: <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>
              </p>
              <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>
                Current Status: <strong>{selectedBooking.status}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmUpdate} className="contact-form">
              <div className="form-group">
                <label htmlFor="new-status">Update Status To</label>
                <select
                  id="new-status"
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
                  <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                    {getAvailableStatusOptions(selectedBooking.status).find(opt => opt.value === newStatus)?.description}
                  </small>
                )}
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

              {success && (
                <div style={{
                  backgroundColor: '#e8f5e8',
                  border: '1px solid #c8e6c9',
                  color: '#2e7d32',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {success}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                <Button variant="secondary" onClick={closeModal} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading || !newStatus}>
                  {loading ? 'Updating...' : 'Confirm Update'}
                </Button>
              </div>
            </form>
          </>
        )}
      </Modal>
    </>
  );
};

export default UpdateStatus;