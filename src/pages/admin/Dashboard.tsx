// src/pages/admin/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { Link } from 'react-router-dom';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboards.css";

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
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Helper function to filter out null values from arrays
  const filterNullIds = (ids: (string | null)[]): string[] => {
    return ids.filter((id): id is string => id !== null && id !== undefined);
  };

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
        const serviceIds = filterNullIds([...new Set(bookingsData.map(booking => booking.service_id))]);
        let servicesData: any[] = [];
        if (serviceIds.length > 0) {
          const { data: services } = await supabase
            .from('services')
            .select('*')
            .in('id', serviceIds);
          servicesData = services || [];
        }

        // Fetch customer details
        const customerIds = filterNullIds([...new Set(bookingsData.map(booking => booking.customer_id))]);
        let customersData: any[] = [];
        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', customerIds);
          customersData = customers || [];
        }

        // Fetch staff details - only if there are non-null staff IDs
        const staffIds = filterNullIds([...new Set(bookingsData.map(booking => booking.staff_id))]);
        let staffData: any[] = [];
        if (staffIds.length > 0) {
          const { data: staff } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', staffIds);
          staffData = staff || [];
        }

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
            price: booking.total_price || service?.price || 0, // This is correct - uses booking price first
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

  // FIXED: Use the same logic as the recent bookings table
  const fetchTotalRevenue = async (): Promise<number> => {
    try {
      setRevenueLoading(true);
      console.log('🔄 Fetching total revenue...');
      
      // Fetch ALL completed bookings (not filtered by date)
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('total_price, service_id')
        .eq('status', 'completed');

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError);
        throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
      }

      console.log(`📊 Found ${bookingsData?.length || 0} completed bookings`);

      if (!bookingsData || bookingsData.length === 0) {
        return 0;
      }

      // Get service IDs from bookings (for fallback prices)
      const serviceIds = [...new Set(bookingsData.map(booking => booking.service_id).filter(Boolean))];
      
      // Fetch services data for fallback prices only
      let servicesData: any[] = [];
      if (serviceIds.length > 0) {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('id, price')
          .in('id', serviceIds);

        if (!servicesError) {
          servicesData = services || [];
        }
      }

      // Create a map for quick service lookup (for fallback only)
      const servicesMap = new Map(servicesData.map(service => [service.id, service]));

      // Calculate total revenue using THE SAME LOGIC as the recent bookings table:
      // Use booking.total_price FIRST, then fallback to service price if needed
      const totalRevenue = bookingsData.reduce((sum, booking) => {
        // IMPORTANT: Use booking.total_price FIRST (this is the price stored at booking time)
        // Only use service price as fallback if booking.total_price is null/undefined
        const service = servicesMap.get(booking.service_id);
        const price = booking.total_price || service?.price || 0;
        return sum + (Number(price) || 0);
      }, 0);

      console.log(`💰 Calculated total revenue: ${formatCurrency(totalRevenue)}`);
      return totalRevenue;

    } catch (err: any) {
      console.error('❌ Error in fetchTotalRevenue:', err);
      return 0;
    } finally {
      setRevenueLoading(false);
    }
  };

  // Fetch dashboard statistics with better error handling
  const fetchDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

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

      // Get total revenue using the accurate function
      newStats.totalRevenue = await fetchTotalRevenue();

      // Get today's bookings
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

      // Get staff count
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
            const uniqueStaffIds = filterNullIds([...new Set(bookingsData.map(b => b.staff_id))]);
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
      render: (item: BookingWithRelations) => (
        <span className="service-name">
          {item.service_name}
        </span>
      )
    },
    { 
      header: 'Customer', 
      key: 'customerName',
      render: (item: BookingWithRelations) => (
        <div className="customer-info-container">
          <div className="customer-name">{item.customer_name}</div>
          {item.customer_email && (
            <div className="customer-email">
              ✉️ {item.customer_email}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Staff', 
      key: 'staffName',
      render: (item: BookingWithRelations) => (
        <span className="staff-name">
          {item.staff_name || 'Unassigned'}
        </span>
      )
    },
    { 
      header: 'Date & Time', 
      key: 'datetime',
      render: (item: BookingWithRelations) => (
        <span className="datetime-text">
          {formatDateTime(item.booking_date, item.booking_time)}
        </span>
      )
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
        const statusClass = `booking-status-badge booking-status-badge-${item.status}`;
        return (
          <span className={statusClass}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        );
      }
    },
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title={`Hello Admin, ${user?.first_name}!`} />
        <div className="dashboard-content-wrapper">
          {/* Error Message */}
          {error && (
            <div className="dashboard-error">
              <strong>Error:</strong> {error}
              <div className="dashboard-error-actions">
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={fetchDashboardData}
                  style={{ fontSize: '14px', marginRight: '8px' }}
                >
                  Try Again
                </Button>
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={() => console.log('Debug info:', { recentBookings, stats, user })}
                  style={{ fontSize: '14px' }}
                >
                  Debug Info
                </Button>
              </div>
            </div>
          )}

          <h2 className="dashboard-page-title">
            Dashboard Overview
          </h2>

          {/* Quick Stats */}
          <div className="quick-stats-grid">
            <div className="stat-card stat-card-revenue">
              <h4 className="stat-title stat-title-revenue">Total Revenue</h4>
              <p className="stat-value stat-value-revenue">
                {revenueLoading ? 'Calculating...' : formatCurrency(stats.totalRevenue)}
              </p>
              <p className="stat-description">
                All Completed Bookings • {stats.completedBookings} bookings
              </p>
            </div>
            
            <div className="stat-card stat-card-today">
              <h4 className="stat-title stat-title-today">Today's Bookings</h4>
              <p className="stat-value stat-value-today">
                {stats.todayBookings}
              </p>
              <p className="stat-description">
                Appointments Today
              </p>
            </div>
            
            <div className="stat-card stat-card-staff">
              <h4 className="stat-title stat-title-staff">Active Staff</h4>
              <p className="stat-value stat-value-staff">
                {stats.activeStaff}
              </p>
              <p className="stat-description">
                Staff Members
              </p>
            </div>
          </div>

          {/* Booking Status Overview */}
          <div className="booking-status-grid">
            <div className="status-card status-card-pending">
              <h4 className="status-title status-title-pending">Pending</h4>
              <p className="status-value status-value-pending">
                {stats.pendingBookings}
              </p>
            </div>
            
            <div className="status-card status-card-confirmed">
              <h4 className="status-title status-title-confirmed">Confirmed</h4>
              <p className="status-value status-value-confirmed">
                {stats.confirmedBookings}
              </p>
            </div>
            
            <div className="status-card status-card-completed">
              <h4 className="status-title status-title-completed">Completed</h4>
              <p className="status-value status-value-completed">
                {stats.completedBookings}
              </p>
            </div>
            
            <div className="status-card status-card-total">
              <h4 className="status-title status-title-total">Total</h4>
              <p className="status-value status-value-total">
                {stats.pendingBookings + stats.confirmedBookings + stats.completedBookings}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-grid">
            <Link to="/admin/bookings" className="action-card action-card-bookings">
              <h4 className="action-title action-title-bookings">📊 All Bookings</h4>
              <p className="action-description">
                Manage and view all appointments
              </p>
            </Link>
            
            <Link to="/admin/staff" className="action-card action-card-staff">
              <h4 className="action-title action-title-staff">👥 Staff Management</h4>
              <p className="action-description">
                Manage staff members and schedules
              </p>
            </Link>
            
            <Link to="/admin/services" className="action-card action-card-services">
              <h4 className="action-title action-title-services">💅 Services</h4>
              <p className="action-description">
                Manage services and pricing
              </p>
            </Link>
          </div>

          {/* Recent Bookings Section */}
          <section className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">
                Recent Bookings
              </h3>
              <Link to="/admin/bookings">
                <Button variant="primary" size="medium">
                  View All Bookings
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading recent bookings...</p>
              </div>
            ) : recentBookings.length > 0 ? (
              <div className="table-responsive">
                <Table 
                  data={recentBookings} 
                  columns={bookingColumns}
                  className="booking-table"
                />
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">
                  No recent bookings found.
                </p>
                <p className="empty-state-subtext">
                  When customers book appointments, they will appear here.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;