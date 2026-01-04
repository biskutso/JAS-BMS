// src/pages/staff/CheckSchedule.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { Booking, BookingStatus } from '@models/booking';
import { formatCurrency, formatDate } from '@utils/helpers';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
import { SupabaseNotificationService } from '../../services/supabaseNotificationService';
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

const CheckSchedule: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCustomerDetails = async (customerIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .in('id', customerIds);

      if (error) {
        console.error('Error fetching customer details:', error);
        return customerIds.map(id => ({
          id,
          first_name: 'Customer',
          last_name: '',
          email: 'unknown@example.com',
          phone: 'Unknown'
        }));
      }

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
      console.error('Error in fetchCustomerDetails:', err);
      return customerIds.map(id => ({
        id,
        first_name: 'Customer',
        last_name: '',
        email: 'unknown@example.com',
        phone: 'Unknown'
      }));
    }
  };

  const fetchStaffBookingsSimple = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your schedule.');
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', user.id)
        .eq('booking_date', selectedDate)
        .order('booking_time', { ascending: true });

      if (error) {
        console.error('Simple fetch error:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const customerIds = [...new Set(data.map(booking => booking.customer_id))];
        const customersData = await fetchCustomerDetails(customerIds);

        const serviceIds = [...new Set(data.map(booking => booking.service_id))];
        const { data: servicesData } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

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
      console.error('Simple fetch failed:', err);
      setError('Unable to load schedule data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffBookingsSimple();
  }, [user, selectedDate]);

  const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      setError(null);
      setSuccess(null);
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .eq('staff_id', user?.id);

      if (error) throw error;

      let notificationSent = false;
      try {
        if (newStatus === 'confirmed') {
          await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_confirmed');
          notificationSent = true;
        } else if (newStatus === 'completed') {
          await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_completed');
          notificationSent = true;
        } else if (newStatus === 'cancelled') {
          await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_cancelled');
          notificationSent = true;
        }
      } catch (notificationError) {
        console.error('Notification failed, but booking was updated:', notificationError);
      }

      await fetchStaffBookingsSimple();
      
      const successMessage = notificationSent
        ? `Booking status updated to ${newStatus}! Customer notified.`
        : `Booking status updated to ${newStatus}!`;

      setSuccess(successMessage);
    } catch (err: any) {
      console.error('Error updating booking status:', err);
      setError('Failed to update booking status. Please try again.');
    }
  };

  const formatTime = (time: string) => {
    if (!time) return 'N/A';
    
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
  };

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
          <div className="time-slot">{formatTime(item.booking_time)}</div>
          <div className="time-end">
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
          <div className="customer-name">{item.customer_name}</div>
          <div className="customer-email">
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
        <div className="schedule-actions">
          {(item.status === 'pending' || item.status === 'confirmed') && (
            <>
              <Button 
                variant="secondary" 
                size="small"
                onClick={() => updateBookingStatus(item.id, 'completed')}
                className="complete-button"
              >
                Mark Complete
              </Button>
              <Button 
                variant="text" 
                size="small"
                onClick={() => updateBookingStatus(item.id, 'cancelled')}
                className="cancel-button"
              >
                Cancel
              </Button>
            </>
          )}
          {item.status === 'completed' && (
            <span className="completed-label">Completed</span>
          )}
          {item.status === 'cancelled' && (
            <span className="cancelled-label">Cancelled</span>
          )}
        </div>
      )
    },
  ];

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="My Schedule" />
          
          <div className="booking-header">
            <h1 className="page-title">My Schedule</h1>
            <p className="page-subtitle">
              View your appointments for the day and manage your schedule.
            </p>
          </div>

          {/* Date Selection */}
          <div className="date-selection">
            <label htmlFor="schedule-date" className="date-label">Select Date:</label>
            <input
              type="date"
              id="schedule-date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
            <Button 
              variant="secondary" 
              size="small"
              onClick={fetchStaffBookingsSimple}
              disabled={loading}
              className="refresh-button"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          {success && (
            <div className="dashboard-success">
              {success}
            </div>
          )}

          {error && (
            <div className="dashboard-error">
              {error}
              <div className="error-actions">
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={fetchStaffBookingsSimple}
                  className="retry-button"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="stats-grid">
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
            <div className="stat-card total-card">
              <p className="stat-number">{bookings.length}</p>
              <p className="stat-label">Total</p>
            </div>
          </div>

          {/* Bookings Table */}
          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Schedule for {formatDate(selectedDate)}
              </h2>
              <div className="section-actions">
                <span className="appointment-count">
                  {bookings.length} appointment{bookings.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading your schedule...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="empty-booking-state">
                <p className="empty-message">No appointments scheduled for {formatDate(selectedDate)}.</p>
                <p className="empty-subtext">
                  When customers book appointments and select you as their preferred staff, they will appear here.
                </p>
              </div>
            ) : (
              <Table 
                data={bookings} 
                columns={columns} 
                caption={`Your Appointments for ${formatDate(selectedDate)}`}
              />
            )}
          </div>

          {/* Notes Section */}
          <div className="info-banner">
            <h4 className="banner-title">Schedule Notes</h4>
            <ul className="banner-list">
              <li>All times are displayed in your local timezone</li>
              <li>You can mark appointments as completed or cancel them as needed</li>
              <li>Customers will receive notifications when you update their appointment status</li>
              <li>Only appointments where customers specifically selected you will appear here</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckSchedule;