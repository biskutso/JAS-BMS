// src/pages/admin/Dashboard.tsx - UPDATED (supports walk-ins in Recent Bookings + keeps safe null filtering)
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { Link } from 'react-router-dom';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboards.css";

interface BookingWithRelations {
  id: string;

  service_id: number;
  service_name: string;
  service_price: number;
  service_duration: number;

  customer_id: string | null;
  customer_name: string;
  customer_email: string;

  walk_in_customer_id: string | null;
  walk_in_customer_name: string;
  walk_in_customer_phone: string;
  isWalkIn: boolean;

  staff_id: string | null;
  staff_name: string;

  booking_date: string;
  booking_time: string;

  status: BookingStatus;
  price: number;
  notes?: string;
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

  /**
   * IMPORTANT:
   * Use the SAME join name you used in ManageBookings.tsx:
   * walkin:walk_in_customers!bookings_walkin_fk (name, phone_num)
   */
  const WALKIN_FK_JOIN = 'bookings_walkin_fk';

  const filterNullIds = (ids: (string | number | null | undefined)[]) => {
    return ids.filter((id): id is string | number => id !== null && id !== undefined);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Pull recent bookings with joins (services, customers, staff, walk-ins)
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service_id,
          customer_id,
          walk_in_customer_id,
          staff_id,
          booking_date,
          booking_time,
          status,
          total_price,
          notes,
          created_at,

          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          staff:staff_id (first_name, last_name),
          walkin:walk_in_customers!${WALKIN_FK_JOIN} (name, phone_num)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const transformed: BookingWithRelations[] = (data || []).map((b: any) => {
        const isWalkIn = !!b.walk_in_customer_id;

        const regName = `${b.customers?.first_name || ''} ${b.customers?.last_name || ''}`.trim();
        const walkName = b.walkin?.name || '';
        const displayCustomerName = (isWalkIn ? walkName : regName) || 'Unknown Customer';

        const staffName = b.staff
          ? `${b.staff.first_name || ''} ${b.staff.last_name || ''}`.trim()
          : 'Unassigned';

        return {
          id: b.id,

          service_id: b.service_id,
          service_name: b.services?.service_name || 'Unknown Service',
          service_price: b.services?.price ?? 0,
          service_duration: b.services?.duration ?? 60,

          customer_id: b.customer_id ?? null,
          customer_name: displayCustomerName,
          customer_email: isWalkIn ? '' : (b.customers?.email || ''),

          walk_in_customer_id: b.walk_in_customer_id ?? null,
          walk_in_customer_name: b.walkin?.name || '',
          walk_in_customer_phone: b.walkin?.phone_num || '',
          isWalkIn,

          staff_id: b.staff_id ?? null,
          staff_name: staffName,

          booking_date: b.booking_date,
          booking_time: b.booking_time,

          status: b.status as BookingStatus,
          price: b.total_price ?? (b.services?.price ?? 0),
          notes: b.notes || ''
        };
      });

      setRecentBookings(transformed);

      await fetchDashboardStats();
    } catch (err: any) {
      console.error('❌ Error fetching dashboard data:', err);

      if (err.message?.includes('JWT')) {
        setError('Authentication error. Please log in again.');
      } else if (err.message?.includes('policy')) {
        setError('Permission denied. You may need RLS policies configured.');
      } else {
        setError(`Failed to load dashboard data: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalRevenue = async (): Promise<number> => {
    try {
      setRevenueLoading(true);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('total_price, service_id')
        .eq('status', 'completed');

      if (bookingsError) throw bookingsError;

      if (!bookingsData || bookingsData.length === 0) return 0;

      const serviceIds = filterNullIds([...new Set(bookingsData.map(b => b.service_id))]) as number[];

      let servicesData: any[] = [];
      if (serviceIds.length > 0) {
        const { data: services } = await supabase
          .from('services')
          .select('id, price')
          .in('id', serviceIds);
        servicesData = services || [];
      }

      const servicesMap = new Map(servicesData.map(s => [s.id, s]));

      return bookingsData.reduce((sum, b) => {
        const service = servicesMap.get(b.service_id);
        const price = b.total_price ?? service?.price ?? 0;
        return sum + (Number(price) || 0);
      }, 0);
    } catch (err) {
      console.error('❌ Error in fetchTotalRevenue:', err);
      return 0;
    } finally {
      setRevenueLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const newStats: DashboardStats = {
        totalRevenue: await fetchTotalRevenue(),
        todayBookings: 0,
        activeStaff: 0,
        pendingBookings: 0,
        confirmedBookings: 0,
        completedBookings: 0
      };

      // today's bookings
      try {
        const { data } = await supabase.from('bookings').select('id').eq('booking_date', today);
        newStats.todayBookings = data?.length || 0;
      } catch {}

      // staff count
      try {
        const { data } = await supabase.from('users').select('id').eq('role', 'staff');
        newStats.activeStaff = data?.length || 0;
      } catch {}

      // status counts
      try {
        const { data } = await supabase.from('bookings').select('status');
        if (data) {
          newStats.pendingBookings = data.filter(b => b.status === 'pending').length;
          newStats.confirmedBookings = data.filter(b => b.status === 'confirmed').length;
          newStats.completedBookings = data.filter(b => b.status === 'completed').length;
        }
      } catch {}

      setStats(newStats);
    } catch (err) {
      console.error('❌ Error in fetchDashboardStats:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'N/A';
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString();
    if (!time) return formattedDate;
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${formattedDate} at ${displayHour}:${minutes} ${ampm}`;
  };

  const bookingColumns = [
    {
      header: 'Service',
      key: 'service',
      render: (item: BookingWithRelations) => <span className="service-name">{item.service_name}</span>
    },
    {
      header: 'Customer',
      key: 'customer',
      render: (item: BookingWithRelations) => (
        <div className="customer-info-container">
          <div className="customer-name">
            {item.customer_name}
            {item.isWalkIn && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                (Walk-in)
              </span>
            )}
          </div>
          {!item.isWalkIn ? (
            item.customer_email && <div className="customer-email">✉️ {item.customer_email}</div>
          ) : (
            <div className="customer-email">📞 {item.walk_in_customer_phone || '—'}</div>
          )}
        </div>
      )
    },
    {
      header: 'Staff',
      key: 'staff',
      render: (item: BookingWithRelations) => <span className="staff-name">{item.staff_name || 'Unassigned'}</span>
    },
    {
      header: 'Date & Time',
      key: 'datetime',
      render: (item: BookingWithRelations) => (
        <span className="datetime-text">{formatDateTime(item.booking_date, item.booking_time)}</span>
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
      render: (item: BookingWithRelations) => (
        <span className={`booking-status-badge booking-status-badge-${item.status}`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </span>
      )
    }
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title={`Hello Admin, ${user?.first_name}!`} />

        <div className="dashboard-content-wrapper">
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
              </div>
            </div>
          )}

          <h2 className="dashboard-page-title">Dashboard Overview</h2>

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
              <p className="stat-value stat-value-today">{stats.todayBookings}</p>
              <p className="stat-description">Appointments Today</p>
            </div>

            <div className="stat-card stat-card-staff">
              <h4 className="stat-title stat-title-staff">Active Staff</h4>
              <p className="stat-value stat-value-staff">{stats.activeStaff}</p>
              <p className="stat-description">Staff Members</p>
            </div>
          </div>

          <div className="booking-status-grid">
            <div className="status-card status-card-pending">
              <h4 className="status-title status-title-pending">Pending</h4>
              <p className="status-value status-value-pending">{stats.pendingBookings}</p>
            </div>

            <div className="status-card status-card-confirmed">
              <h4 className="status-title status-title-confirmed">Confirmed</h4>
              <p className="status-value status-value-confirmed">{stats.confirmedBookings}</p>
            </div>

            <div className="status-card status-card-completed">
              <h4 className="status-title status-title-completed">Completed</h4>
              <p className="status-value status-value-completed">{stats.completedBookings}</p>
            </div>

            <div className="status-card status-card-total">
              <h4 className="status-title status-title-total">Total</h4>
              <p className="status-value status-value-total">
                {stats.pendingBookings + stats.confirmedBookings + stats.completedBookings}
              </p>
            </div>
          </div>

          <div className="quick-actions-grid">
            <Link to="/admin/bookings" className="action-card action-card-bookings">
              <h4 className="action-title action-title-bookings">📊 All Bookings</h4>
              <p className="action-description">Manage and view all appointments</p>
            </Link>

            <Link to="/admin/staff" className="action-card action-card-staff">
              <h4 className="action-title action-title-staff">👥 Staff Management</h4>
              <p className="action-description">Manage staff members and schedules</p>
            </Link>

            <Link to="/admin/services" className="action-card action-card-services">
              <h4 className="action-title action-title-services">💅 Services</h4>
              <p className="action-description">Manage services and pricing</p>
            </Link>
          </div>

          <section className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">Recent Bookings</h3>
              <Link to="/admin/bookings">
                <Button variant="primary" size="medium">View All Bookings</Button>
              </Link>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading recent bookings...</p>
              </div>
            ) : recentBookings.length > 0 ? (
              <div className="table-responsive">
                <Table data={recentBookings} columns={bookingColumns} className="booking-table" />
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">No recent bookings found.</p>
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
