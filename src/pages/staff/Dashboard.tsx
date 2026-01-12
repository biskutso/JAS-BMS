// src/pages/staff/Dashboard.tsx - UPDATED (supports walk-in customers assigned to staff + avoids null UUID issues)
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/staffdashboards.css";

interface BookingWithRelations {
  id: string;

  service_id: number;
  service_name: string;
  service_price: number;
  service_duration: number;

  // registered user customer
  customer_id: string | null;
  customer_name: string;
  customer_email: string;

  // walk-in customer
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

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * IMPORTANT:
   * Use the SAME join name you used in ManageBookings.tsx:
   * walkin:walk_in_customers!bookings_walkin_fk (name, phone_num)
   * If yours is different, replace below.
   */
  const WALKIN_FK_JOIN = 'bookings_walkin_fk';

  const fetchStaffBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your appointments.');
        setBookings([]);
        return;
      }

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
          updated_at,

          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          walkin:walk_in_customers!${WALKIN_FK_JOIN} (name, phone_num)
        `)
        .eq('staff_id', user.id)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });

      if (error) throw error;

      const mapped: BookingWithRelations[] = (data || []).map((b: any) => {
        const isWalkIn = !!b.walk_in_customer_id;

        const regName = `${b.customers?.first_name || ''} ${b.customers?.last_name || ''}`.trim();
        const walkName = b.walkin?.name || '';

        const displayName = (isWalkIn ? walkName : regName) || 'Unknown Customer';

        return {
          id: b.id,

          service_id: b.service_id,
          service_name: b.services?.service_name || 'Unknown Service',
          service_price: b.services?.price ?? 0,
          service_duration: b.services?.duration ?? 60,

          customer_id: b.customer_id ?? null,
          customer_name: displayName,
          customer_email: isWalkIn ? '' : (b.customers?.email || ''),

          walk_in_customer_id: b.walk_in_customer_id ?? null,
          walk_in_customer_name: b.walkin?.name || '',
          walk_in_customer_phone: b.walkin?.phone_num || '',
          isWalkIn,

          staff_id: b.staff_id ?? null,
          staff_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Current User',

          booking_date: b.booking_date,
          booking_time: b.booking_time,
          status: b.status as BookingStatus,
          price: b.total_price ?? (b.services?.price ?? 0),
          notes: b.notes || ''
        };
      });

      setBookings(mapped);
    } catch (err: any) {
      console.error('❌ Error fetching staff bookings:', err);
      setError(`Failed to load your appointments: ${err.message}`);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  const columns = [
    {
      header: 'Service',
      key: 'service',
      render: (item: BookingWithRelations) => item.service_name
    },
    {
      header: 'Customer',
      key: 'customer',
      render: (item: BookingWithRelations) => (
        <div>
          <div style={{ fontWeight: '500' }}>
            {item.customer_name}
            {item.isWalkIn && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                (Walk-in)
              </span>
            )}
          </div>

          {!item.isWalkIn ? (
            <div className="customer-email">✉️ {item.customer_email || '—'}</div>
          ) : (
            <div className="customer-email">📞 {item.walk_in_customer_phone || '—'}</div>
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
      render: (item: BookingWithRelations) => {
        const statusClass =
          item.status === 'confirmed'
            ? 'booking-status-badge-confirmed'
            : item.status === 'completed'
              ? 'booking-status-badge-completed'
              : item.status === 'cancelled'
                ? 'booking-status-badge-cancelled'
                : 'booking-status-badge-pending';

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
        item.status === 'pending' || item.status === 'confirmed' ? (
          <Link to="/staff/update-status">
            <Button variant="secondary" size="small" className="manage-button">
              Manage
            </Button>
          </Link>
        ) : (
          <span className="completed-label">Completed</span>
        )
      )
    }
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
                <p className="action-description">Check your daily appointments and availability</p>
              </div>
            </Link>

            <Link to="/staff/update-status" className="quick-action-link">
              <div className="quick-action-card manage-action-card">
                <h4 className="action-title">⚡ Manage Appointments</h4>
                <p className="action-description">Update status and manage customer appointments</p>
              </div>
            </Link>
          </div>

          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Upcoming Appointments ({upcomingBookings.length})
              </h2>
              <div className="section-actions">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={fetchStaffBookings}
                  className="refresh-button"
                >
                  Refresh
                </Button>

                <Link to="/staff/schedule">
                  <Button variant="primary" size="small" className="view-full-button">
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
                This is where you'll manage all your appointments. When customers book services and select you
                as their preferred staff (or when an admin assigns you a walk-in booking), their appointments
                will appear here.
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
