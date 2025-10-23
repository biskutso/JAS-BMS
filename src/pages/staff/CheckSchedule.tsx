// src/pages/staff/CheckSchedule.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
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

const CheckSchedule: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FIXED: Safe customer details fetch with fallback
  const fetchCustomerDetails = async (customerIds: string[]) => {
    try {
      console.log('🔄 Fetching customer details for IDs:', customerIds);
      
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', customerIds);

      if (error) {
        console.error('❌ Error fetching customer details:', error);
        // Return fallback data
        return customerIds.map(id => ({
          id,
          first_name: 'Customer',
          last_name: '',
          email: 'unknown@example.com',
          phone: 'Unknown'
        }));
      }

      console.log('✅ Customer details fetched:', data);

      // If no data found, return fallback
      if (!data || data.length === 0) {
        return customerIds.map(id => ({
          id,
          first_name: 'Customer',
          last_name: '',
          email: 'unknown@example.com',
          phone: 'Unknown'
        }));
      }

      return data.map(user => ({
        id: user.id,
        first_name: user.first_name || 'Customer',
        last_name: user.last_name || '',
        email: user.email || 'unknown@example.com',
        phone: 'Unknown' // Your users table doesn't have phone column
      }));

    } catch (err) {
      console.error('❌ Error in fetchCustomerDetails:', err);
      return customerIds.map(id => ({
        id,
        first_name: 'Customer',
        last_name: '',
        email: 'unknown@example.com',
        phone: 'Unknown'
      }));
    }
  };

  // Fetch staff bookings from Supabase - FIXED: Using correct table structure
  const fetchStaffBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your schedule.');
        return;
      }

      console.log('🔄 Fetching bookings for staff:', user.id, 'on date:', selectedDate);

      // Get bookings for this staff member
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', user.id)
        .eq('booking_date', selectedDate)
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
        console.log('🔄 Fetching services for IDs:', serviceIds);
        
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        if (servicesError) {
          console.error('❌ Error fetching services:', servicesError);
        }

        console.log('✅ Services fetched:', servicesData);

        // Fetch customer details with the new safe function
        const customerIds = [...new Set(data.map(booking => booking.customer_id))];
        const customersData = await fetchCustomerDetails(customerIds);

        // Transform data to match BookingWithRelations interface
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
            customer_phone: customer?.phone || 'Unknown',
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
        // No bookings found
        setBookings([]);
      }

    } catch (err: any) {
      console.error('❌ Error fetching staff bookings:', err);
      
      // Provide more specific error messages
      if (err.message?.includes('JWT')) {
        setError('Authentication error. Please log in again.');
      } else if (err.message?.includes('foreign key')) {
        setError('Database relationship error. Please contact support.');
      } else {
        setError('Failed to load your schedule. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Alternative simpler fetch method - FIXED: Using safe customer data
  const fetchStaffBookingsSimple = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your schedule.');
        return;
      }

      console.log('🔄 Simple fetch for staff:', user.id, 'on date:', selectedDate);

      // Simple query without complex joins
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', user.id)
        .eq('booking_date', selectedDate)
        .order('booking_time', { ascending: true });

      if (error) {
        console.error('❌ Simple fetch error:', error);
        throw error;
      }

      console.log('✅ Simple bookings fetched:', data);

      // If we have data, fetch customer details properly
      if (data && data.length > 0) {
        const customerIds = [...new Set(data.map(booking => booking.customer_id))];
        const customersData = await fetchCustomerDetails(customerIds);

        // Fetch service details
        const serviceIds = [...new Set(data.map(booking => booking.service_id))];
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        // Transform the data with proper customer info
        const staffBookings: BookingWithRelations[] = data.map(booking => {
          const service = servicesData?.find(s => s.id === booking.service_id);
          const customer = customersData?.find(c => c.id === booking.customer_id);

          return {
            id: booking.id,
            serviceId: booking.service_id,
            serviceName: service?.service_name || 'Service',
            service_name: service?.service_name || 'Service',
            service_price: service?.price || booking.total_price || 0,
            service_duration: service?.duration || 60,
            customerId: booking.customer_id,
            customerName: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer',
            customer_name: customer ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : 'Customer',
            customer_email: customer?.email || '',
            customer_phone: customer?.phone || 'Unknown',
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
      console.error('❌ Simple fetch failed:', err);
      setError('Unable to load schedule data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Try the simple fetch first
    fetchStaffBookingsSimple();
  }, [user, selectedDate]);

  // Update booking status
  const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      setError(null);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .eq('staff_id', user?.id);

      if (error) throw error;

      // Refresh the bookings list
      await fetchStaffBookingsSimple();
    } catch (err: any) {
      console.error('❌ Error updating booking status:', err);
      setError('Failed to update booking status. Please try again.');
    }
  };

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return 'N/A';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Calculate end time based on service duration
  const calculateEndTime = (startTime: string, duration: number) => {
    if (!startTime) return 'N/A';
    
    const [hours, minutes] = startTime.split(':');
    const startDate = new Date();
    startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
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
          <div style={{ fontWeight: '500' }}>{formatTime(item.booking_time)}</div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            to {calculateEndTime(item.booking_time, item.service_duration)}
          </div>
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
          <div style={{ fontWeight: '500' }}>{item.customer_name}</div>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>
            ✉️ {item.customer_email}
          </div>
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
        <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <>
              <Button 
                variant="secondary" 
                size="small"
                onClick={() => updateBookingStatus(item.id, 'completed')}
                style={{ fontSize: '12px', padding: '4px 8px' }}
              >
                Mark Complete
              </Button>
              <Button 
                variant="text" 
                size="small"
                onClick={() => updateBookingStatus(item.id, 'cancelled')}
                style={{ fontSize: '12px', padding: '4px 8px', color: '#d32f2f' }}
              >
                Cancel
              </Button>
            </>
          )}
          {item.status === 'completed' && (
            <span style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>
              Completed
            </span>
          )}
          {item.status === 'cancelled' && (
            <span style={{ color: '#666', fontStyle: 'italic', fontSize: '12px' }}>
              Cancelled
            </span>
          )}
        </div>
      )
    },
  ];

  // Quick stats for the day
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  return (
    <>
      <DashboardHeader title="My Schedule" />
      <div className="page-container">
        <p className="section-subtitle" style={{ textAlign: 'left', marginBottom: 'var(--spacing-lg)' }}>
          View your appointments for the day and manage your schedule.
        </p>

        {/* Date Selection */}
        <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <label htmlFor="schedule-date" style={{ fontFamily: 'var(--font-family-sans-serif)', fontWeight: 500 }}>Select Date:</label>
          <input
            type="date"
            id="schedule-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ 
              padding: 'var(--spacing-xs) var(--spacing-sm)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 'var(--border-radius-sm)',
              fontFamily: 'var(--font-family-sans-serif)'
            }}
          />
          <Button 
            variant="secondary" 
            size="small"
            onClick={fetchStaffBookingsSimple}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="text" 
            size="small"
            onClick={() => {
              console.log('Debug: Current user:', user);
              console.log('Debug: Current bookings:', bookings);
            }}
            style={{ fontSize: '12px' }}
          >
            Debug
          </Button>
        </div>

        {/* Error Message */}
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
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <Button 
                variant="text" 
                size="small" 
                onClick={fetchStaffBookingsSimple}
                style={{ fontSize: '12px', padding: '2px 6px' }}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          <div style={{
            padding: 'var(--spacing-md)',
            backgroundColor: '#fff3e0',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #ffb74d'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#f57c00' }}>
              {pendingBookings}
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
              {confirmedBookings}
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
              {completedBookings}
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

        {/* Bookings Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading your schedule...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px',
            backgroundColor: '#f9f9f9',
            borderRadius: 'var(--border-radius)',
            border: '1px solid #e0e0e0'
          }}>
            <p style={{ color: '#666', marginBottom: 'var(--spacing-md)' }}>
              No appointments scheduled for {formatDate(selectedDate)}.
            </p>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              When customers book appointments and select you as their preferred staff, they will appear here.
            </p>
          </div>
        ) : (
          <Table 
            data={bookings} 
            columns={columns} 
            caption={`Your Appointments for ${formatDate(selectedDate)} - ${bookings.length} booking(s)`}
          />
        )}

        {/* Notes Section */}
        <div style={{ 
          marginTop: 'var(--spacing-xl)',
          padding: 'var(--spacing-md)',
          backgroundColor: '#f0f8ff',
          borderRadius: 'var(--border-radius)',
          border: '1px solid #b3d9ff'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#0066cc' }}>Schedule Notes</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666', fontSize: '0.875rem' }}>
            <li>All times are displayed in your local timezone</li>
            <li>You can mark appointments as completed or cancel them as needed</li>
            <li>Customers will receive notifications when you update their appointment status</li>
            <li>Only appointments where customers specifically selected you will appear here</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default CheckSchedule;