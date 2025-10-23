// src/pages/staff/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
import { Link } from 'react-router-dom';
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

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch staff bookings from Supabase
  const fetchStaffBookings = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookings();
  }, [user]);

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
          <Link to="/staff/update-status">
            <Button variant="secondary" size="small">Manage</Button>
          </Link>
        ) : (
          <span style={{ color: '#666', fontStyle: 'italic' }}>Completed</span>
        )
      )
    },
  ];

  // Filter bookings
  const upcomingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const recentBookings = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  // Quick stats
  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = bookings.filter(b => b.booking_date === today);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  return (
    <>
      <DashboardHeader title={`Welcome, ${user?.first_name}!`} />
      <div className="page-container">
        {/* Error Message */}
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
            <div style={{ marginTop: '8px' }}>
              <Button 
                variant="text" 
                size="small" 
                onClick={fetchStaffBookings}
                style={{ fontSize: '12px' }}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--primary-light)',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid var(--primary)'
          }}>
            <h3 style={{ margin: 0, fontSize: '2rem', color: 'var(--primary)' }}>
              {todaysBookings.length}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Today's Appointments</p>
          </div>
          <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: '#fff3e0',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #ffb74d'
          }}>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#f57c00' }}>
              {pendingBookings}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pending</p>
          </div>
          <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: '#e8f5e8',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #81c784'
          }}>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#2e7d32' }}>
              {confirmedBookings}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Confirmed</p>
          </div>
          <div style={{
            padding: 'var(--spacing-lg)',
            backgroundColor: '#e3f2fd',
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #64b5f6'
          }}>
            <h3 style={{ margin: 0, fontSize: '2rem', color: '#1565c0' }}>
              {completedBookings}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Completed</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <Link to="/staff/schedule" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#f0f8ff',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '2px solid #b3d9ff',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#0066cc' }}>📅 View Schedule</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Check your daily appointments and availability
              </p>
            </div>
          </Link>
          
          <Link to="/staff/update-status" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#f8fff0',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '2px solid #c8e6c9',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>⚡ Manage Appointments</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Update status and manage customer appointments
              </p>
            </div>
          </Link>
        </div>

        {/* Upcoming Appointments Section */}
        <section style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)' 
          }}>
            <h2 style={{ 
              fontSize: '1.8rem', 
              fontFamily: 'var(--font-family-serif)',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Upcoming Appointments ({upcomingBookings.length})
            </h2>
            <Link to="/staff/schedule">
              <Button variant="primary" size="medium">
                View Full Schedule
              </Button>
            </Link>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading your appointments...</p>
            </div>
          ) : upcomingBookings.length > 0 ? (
            <Table data={upcomingBookings} columns={columns} />
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: 'var(--spacing-xl)',
              backgroundColor: 'var(--gray-50)',
              borderRadius: 'var(--border-radius)'
            }}>
              <p style={{ 
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                No upcoming appointments found.
              </p>
              <p style={{ 
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                When customers book appointments with you, they will appear here.
              </p>
            </div>
          )}
        </section>

        {/* Recent Appointments Section */}
        {recentBookings.length > 0 && (
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
                Recent Appointments ({recentBookings.length})
                <span style={{ float: 'right', fontSize: '1rem' }}>▼</span>
              </summary>
              <div style={{ padding: 'var(--spacing-md) 0' }}>
                <Table data={recentBookings} columns={columns} />
              </div>
            </details>
          </section>
        )}

        {/* Welcome Message for New Staff */}
        {!loading && bookings.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-xl)',
            backgroundColor: '#f0f8ff',
            borderRadius: 'var(--border-radius)',
            border: '1px solid #b3d9ff',
            marginTop: 'var(--spacing-xl)'
          }}>
            <h3 style={{ color: '#0066cc', marginBottom: 'var(--spacing-md)' }}>
              Welcome to Your Staff Dashboard!
            </h3>
            <p style={{ color: '#666', marginBottom: 'var(--spacing-md)' }}>
              This is where you'll manage all your appointments. When customers book services and select you as their preferred staff, 
              their appointments will appear here.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--spacing-md)' }}>
              <Link to="/staff/schedule">
                <Button variant="primary" size="medium">
                  Check Schedule
                </Button>
              </Link>
              <Link to="/staff/update-status">
                <Button variant="secondary" size="medium">
                  Manage Appointments
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default StaffDashboard;