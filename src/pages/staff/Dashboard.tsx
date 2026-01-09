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
import "../../assets/styles/staffdashboards.css";

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

  // Fetch customer details
  const fetchCustomerDetails = async (customerIds: string[]) => {
    try {
      console.log('🔄 Fetching customer details for IDs:', customerIds);
      
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', customerIds);

      if (error) {
        console.error('❌ Error fetching customer details:', error);
        return customerIds.map(id => ({
          id,
          first_name: 'Customer',
          last_name: '',
          email: 'unknown@example.com',
          phone: 'Unknown'
        }));
      }

      console.log('✅ Customer details fetched:', data);

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
        phone: 'Unknown'
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

      if (data && data.length > 0) {
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

        const customerIds = [...new Set(data.map(booking => booking.customer_id))];
        const customersData = await fetchCustomerDetails(customerIds);

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
          <div className="customer-email">
            ✉️ {item.customer_email}
          </div>
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
          <Link to="/staff/update-status">
            <Button 
              variant="secondary" 
              size="small" 
              className="manage-button"
            >
              Manage
            </Button>
          </Link>
        ) : (
          <span className="completed-label">Completed</span>
        )
      )
    },
  ];

  const upcomingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const recentBookings = bookings.filter(b => b.status === 'completed' || b.status === 'cancelled');

  const today = new Date().toISOString().split('T')[0];
  const todaysBookings = bookings.filter(b => b.booking_date === today);
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title={`Welcome, ${user?.first_name || 'Staff'}!`} />
          
          {/* <div className="booking-header">
            <h1 className="page-title">Staff Dashboard</h1>
            <p className="page-subtitle">
              Manage your appointments, view your schedule, and update booking statuses.
            </p>
          </div> */}

          {error && (
            <div className="dashboard-error">
              {error}
              <div style={{ marginTop: '8px' }}>
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={fetchStaffBookings}
                  className="retry-button"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card today-card">
              <p className="stat-number">{todaysBookings.length}</p>
              <p className="stat-label">Today's Appointments</p>
            </div>
            <div className="stat-card pending-card">
              <p className="stat-number">{pendingBookings}</p>
              <p className="stat-label">Pending</p>
            </div>
            <div className="stat-card confirmed-card">
              <p className="stat-number">{confirmedBookings}</p>
              <p className="stat-label">Confirmed</p>
            </div>
            <div className="stat-card completed-card">
              <p className="stat-number">{completedBookings}</p>
              <p className="stat-label">Completed</p>
            </div>
          </div>

          <div className="quick-actions-grid">
            <Link to="/staff/schedule" className="quick-action-link">
              <div className="quick-action-card schedule-action-card">
                <h4 className="action-title">📅 View Schedule</h4>
                <p className="action-description">
                  Check your daily appointments and availability
                </p>
              </div>
            </Link>
            
            <Link to="/staff/update-status" className="quick-action-link">
              <div className="quick-action-card manage-action-card">
                <h4 className="action-title">⚡ Manage Appointments</h4>
                <p className="action-description">
                  Update status and manage customer appointments
                </p>
              </div>
            </Link>
          </div>

          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Upcoming Appointments ({upcomingBookings.length})
              </h2>
              <div className="section-actions">
                <Link to="/staff/schedule">
                  <Button 
                    variant="primary" 
                    size="small" 
                    className="view-full-button"
                  >
                    View Full Schedule
                  </Button>
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading your appointments...</p>
              </div>
            ) : upcomingBookings.length > 0 ? (
              <Table data={upcomingBookings} columns={columns} />
            ) : (
              <div className="empty-booking-state">
                <p className="empty-message">No upcoming appointments found.</p>
                <p className="empty-subtext">
                  When customers book appointments with you, they will appear here.
                </p>
              </div>
            )}
          </div>

          {recentBookings.length > 0 && (
            <div className="recent-bookings-section">
              <details className="recent-bookings-details">
                <summary className="recent-bookings-summary">
                  Recent Appointments ({recentBookings.length})
                  <span className="dropdown-icon">▼</span>
                </summary>
                <div className="recent-bookings-content">
                  <Table data={recentBookings} columns={columns} />
                </div>
              </details>
            </div>
          )}

          {!loading && bookings.length === 0 && (
            <div className="welcome-message">
              <h3>Welcome to Your Staff Dashboard!</h3>
              <p>
                This is where you'll manage all your appointments. When customers book services and select you as their preferred staff, 
                their appointments will appear here.
              </p>
              <div className="welcome-actions">
                <Link to="/staff/schedule">
                  <Button variant="primary" size="small">
                    Check Schedule
                  </Button>
                </Link>
                <Link to="/staff/update-status">
                  <Button variant="secondary" size="small">
                    Manage Appointments
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;