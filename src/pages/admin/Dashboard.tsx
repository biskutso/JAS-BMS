// src/pages/admin/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { Link } from 'react-router-dom';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
import { supabase } from '../../supabaseClient';

interface BookingWithRelations extends Booking {
  service_name: string;
  service_price: number;
  service_duration: number;
  customer_name: string;
  customer_email: string;
  staff_name: string;
  booking_date: string;
  booking_time: string;
}

interface DashboardStats {
  totalRevenue: number;
  todayBookings: number;
  activeStaff: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [recentBookings, setRecentBookings] = useState<BookingWithRelations[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    todayBookings: 0,
    activeStaff: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Fetching admin dashboard data...');

      // First, try to fetch basic bookings without complex joins
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (bookingsError) {
        console.error('❌ Error fetching basic bookings:', bookingsError);
        throw bookingsError;
      }

      console.log('✅ Basic bookings fetched:', bookingsData);

      // If we have bookings, try to fetch related data
      if (bookingsData && bookingsData.length > 0) {
        // Fetch service details
        const serviceIds = [...new Set(bookingsData.map(booking => booking.service_id))];
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        // Fetch customer details
        const customerIds = [...new Set(bookingsData.map(booking => booking.customer_id))];
        const { data: customersData } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', customerIds);

        // Fetch staff details
        const staffIds = [...new Set(bookingsData.map(booking => booking.staff_id))];
        const { data: staffData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', staffIds);

        // Transform bookings data
        const transformedBookings: BookingWithRelations[] = bookingsData.map(booking => {
          const service = servicesData?.find(s => s.id === booking.service_id);
          const customer = customersData?.find(c => c.id === booking.customer_id);
          const staff = staffData?.find(s => s.id === booking.staff_id);
          
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
            staffId: booking.staff_id,
            staffName: staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : 'Unassigned',
            staff_name: staff ? `${staff.first_name || ''} ${staff.last_name || ''}`.trim() : 'Unassigned',
            startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
            endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
            booking_date: booking.booking_date,
            booking_time: booking.booking_time,
            status: booking.status as BookingStatus,
            price: booking.total_price || service?.price || 0,
            notes: booking.notes || ''
          };
        });

        setRecentBookings(transformedBookings);
      } else {
        setRecentBookings([]);
      }

      // Fetch statistics
      await fetchDashboardStats();

    } catch (err: any) {
      console.error('❌ Error fetching dashboard data:', err);
      
      if (err.message?.includes('JWT')) {
        setError('Authentication error. Please log in again.');
      } else if (err.message?.includes('policy')) {
        setError('Permission denied. You may need RLS policies configured.');
      } else {
        setError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch dashboard statistics with better error handling
  const fetchDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      console.log('🔄 Fetching dashboard statistics...');

      // Initialize stats
      const newStats: DashboardStats = {
        totalRevenue: 0,
        todayBookings: 0,
        activeStaff: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0
      };

      // Get total revenue (completed bookings this month) - simplified
      try {
        const { data: revenueData, error: revenueError } = await supabase
          .from('bookings')
          .select('total_price, status')
          .eq('status', 'completed');

        if (!revenueError && revenueData) {
          newStats.totalRevenue = revenueData.reduce((sum, booking) => sum + (booking.total_price || 0), 0);
        }
      } catch (revenueErr) {
        console.error('❌ Error fetching revenue:', revenueErr);
      }

      // Get today's bookings - simplified
      try {
        const { data: todayData, error: todayError } = await supabase
          .from('bookings')
          .select('id')
          .eq('booking_date', today);

        if (!todayError && todayData) {
          newStats.todayBookings = todayData.length;
        }
      } catch (todayErr) {
        console.error('❌ Error fetching today bookings:', todayErr);
      }

      // Get staff count - simplified (remove is_active filter)
      try {
        const { data: staffData, error: staffError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'staff');

        if (!staffError && staffData) {
          newStats.activeStaff = staffData.length;
        }
      } catch (staffErr) {
        console.error('❌ Error fetching staff count:', staffErr);
        // Fallback: count unique staff in bookings
        try {
          const { data: bookingsData } = await supabase
            .from('bookings')
            .select('staff_id')
            .not('staff_id', 'is', null);

          if (bookingsData) {
            const uniqueStaffIds = [...new Set(bookingsData.map(b => b.staff_id))];
            newStats.activeStaff = uniqueStaffIds.length;
          }
        } catch (fallbackErr) {
          console.error('❌ Fallback staff count failed:', fallbackErr);
        }
      }

      // Get booking counts by status
      try {
        const { data: allBookings, error: allError } = await supabase
          .from('bookings')
          .select('status');

        if (!allError && allBookings) {
          newStats.pendingBookings = allBookings.filter(b => b.status === 'pending').length;
          newStats.confirmedBookings = allBookings.filter(b => b.status === 'confirmed').length;
          newStats.completedBookings = allBookings.filter(b => b.status === 'completed').length;
        }
      } catch (statusErr) {
        console.error('❌ Error fetching booking status counts:', statusErr);
      }

      console.log('✅ Stats calculated:', newStats);
      setStats(newStats);

    } catch (err: any) {
      console.error('❌ Error in fetchDashboardStats:', err);
      // Don't set error here - we want to show the dashboard even if stats fail
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  const bookingColumns = [
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
          {item.customer_email && (
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              ✉️ {item.customer_email}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Staff', 
      key: 'staffName',
      render: (item: BookingWithRelations) => item.staff_name || 'Unassigned'
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
  ];

  return (
    <>
      <DashboardHeader title={`Hello Admin, ${user?.first_name}!`} />
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
            <strong>Error:</strong> {error}
            <div style={{ marginTop: '8px' }}>
              <Button 
                variant="text" 
                size="small" 
                onClick={fetchDashboardData}
                style={{ fontSize: '12px', marginRight: '8px' }}
              >
                Try Again
              </Button>
              <Button 
                variant="text" 
                size="small" 
                onClick={() => console.log('Debug info:', { recentBookings, stats, user })}
                style={{ fontSize: '12px' }}
              >
                Debug Info
              </Button>
            </div>
          </div>
        )}

        <h2 style={{ 
          marginBottom: 'var(--spacing-lg)', 
          fontSize: '2rem', 
          fontFamily: 'var(--font-family-serif)',
          color: 'var(--text-primary)'
        }}>
          Dashboard Overview
        </h2>

        {/* Quick Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: 'var(--spacing-lg)', 
          marginBottom: 'var(--spacing-xl)' 
        }}>
          <div style={{ 
            padding: 'var(--spacing-lg)', 
            border: '1px solid #e0e0e0', 
            borderRadius: 'var(--border-radius)', 
            backgroundColor: 'white', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#2c5530', fontSize: '1rem' }}>Total Revenue</h4>
            <p style={{ fontSize: '2rem', fontFamily: 'var(--font-family-serif)', color: '#2c5530', margin: 0, fontWeight: 'bold' }}>
              {formatCurrency(stats.totalRevenue)}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: '8px 0 0 0' }}>
              All Completed Bookings
            </p>
          </div>
          
          <div style={{ 
            padding: 'var(--spacing-lg)', 
            border: '1px solid #e0e0e0', 
            borderRadius: 'var(--border-radius)', 
            backgroundColor: 'white', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#1976d2', fontSize: '1rem' }}>Today's Bookings</h4>
            <p style={{ fontSize: '2rem', fontFamily: 'var(--font-family-serif)', color: '#1976d2', margin: 0, fontWeight: 'bold' }}>
              {stats.todayBookings}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: '8px 0 0 0' }}>
              Appointments Today
            </p>
          </div>
          
          <div style={{ 
            padding: 'var(--spacing-lg)', 
            border: '1px solid #e0e0e0', 
            borderRadius: 'var(--border-radius)', 
            backgroundColor: 'white', 
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ed6c02', fontSize: '1rem' }}>Active Staff</h4>
            <p style={{ fontSize: '2rem', fontFamily: 'var(--font-family-serif)', color: '#ed6c02', margin: 0, fontWeight: 'bold' }}>
              {stats.activeStaff}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#666', margin: '8px 0 0 0' }}>
              Staff Members
            </p>
          </div>
        </div>

        {/* Booking Status Overview */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
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
            <h4 style={{ margin: '0 0 8px 0', color: '#f57c00', fontSize: '0.875rem' }}>Pending</h4>
            <p style={{ fontSize: '1.5rem', color: '#f57c00', margin: 0, fontWeight: 'bold' }}>
              {stats.pendingBookings}
            </p>
          </div>
          
          <div style={{ 
            padding: 'var(--spacing-md)', 
            backgroundColor: '#e8f5e8', 
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #81c784'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '0.875rem' }}>Confirmed</h4>
            <p style={{ fontSize: '1.5rem', color: '#2e7d32', margin: 0, fontWeight: 'bold' }}>
              {stats.confirmedBookings}
            </p>
          </div>
          
          <div style={{ 
            padding: 'var(--spacing-md)', 
            backgroundColor: '#e3f2fd', 
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #64b5f6'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1565c0', fontSize: '0.875rem' }}>Completed</h4>
            <p style={{ fontSize: '1.5rem', color: '#1565c0', margin: 0, fontWeight: 'bold' }}>
              {stats.completedBookings}
            </p>
          </div>
          
          <div style={{ 
            padding: 'var(--spacing-md)', 
            backgroundColor: '#f5f5f5', 
            borderRadius: 'var(--border-radius)',
            textAlign: 'center',
            border: '1px solid #e0e0e0'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '0.875rem' }}>Total</h4>
            <p style={{ fontSize: '1.5rem', color: '#333', margin: 0, fontWeight: 'bold' }}>
              {stats.pendingBookings + stats.confirmedBookings + stats.completedBookings}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <Link to="/admin/bookings" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#f0f8ff',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '2px solid #b3d9ff',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#0066cc' }}>📊 All Bookings</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Manage and view all appointments
              </p>
            </div>
          </Link>
          
          <Link to="/admin/staff" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#f8fff0',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '2px solid #c8e6c9',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32' }}>👥 Staff Management</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Manage staff members and schedules
              </p>
            </div>
          </Link>
          
          <Link to="/admin/services" style={{ textDecoration: 'none' }}>
            <div style={{
              padding: 'var(--spacing-lg)',
              backgroundColor: '#fff0f5',
              borderRadius: 'var(--border-radius)',
              textAlign: 'center',
              border: '2px solid #f8bbd9',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#c2185b' }}>💅 Services</h4>
              <p style={{ margin: 0, color: '#666', fontSize: '0.875rem' }}>
                Manage services and pricing
              </p>
            </div>
          </Link>
        </div>

        {/* Recent Bookings Section */}
        <section style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-md)' 
          }}>
            <h3 style={{ 
              fontSize: '1.8rem', 
              fontFamily: 'var(--font-family-serif)',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Recent Bookings
            </h3>
            <Link to="/admin/bookings">
              <Button variant="primary" size="medium">
                View All Bookings
              </Button>
            </Link>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>Loading recent bookings...</p>
            </div>
          ) : recentBookings.length > 0 ? (
            <Table data={recentBookings} columns={bookingColumns} />
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
                No recent bookings found.
              </p>
              <p style={{ 
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                When customers book appointments, they will appear here.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default AdminDashboard;