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

  const fetchStaffBookings = async () => {
    try {
      setBookingsLoading(true);
      setError(null);

      if (!user) {
        setError('Please log in to view your appointments.');
        return;
      }

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', user.id)
        .order('booking_date', { ascending: true })
        .order('booking_time', { ascending: true });

      if (error) {
        console.error('Error fetching staff bookings:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const serviceIds = [...new Set(data.map(booking => booking.service_id))];
        
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .in('id', serviceIds);

        if (servicesError) {
          console.error('Error fetching services:', servicesError);
        }

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
      console.error('Error fetching staff bookings:', err);
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
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedBooking.id)
        .eq('staff_id', user.id);

      if (error) throw error;

      let notificationSent = false;
      try {
        if (newStatus === 'confirmed') {
          await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_confirmed');
          notificationSent = true;
        } else if (newStatus === 'completed') {
          await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_completed');
          notificationSent = true;
        } else if (newStatus === 'cancelled') {
          await SupabaseNotificationService.createBookingNotification(selectedBooking.id, 'booking_cancelled');
          notificationSent = true;
        }
      } catch (notificationError) {
        console.error('Notification failed, but booking was updated:', notificationError);
      }

      const successMessage = notificationSent 
        ? `Booking status updated to ${newStatus} successfully! Notification sent to customer.`
        : `Booking status updated to ${newStatus} successfully!`;

      setSuccess(successMessage);
      
      await fetchStaffBookings();
      
      setTimeout(() => {
        closeModal();
      }, 2000);
    } catch (err: any) {
      console.error('Status update error:', err);
      setError(err.message || 'Failed to update booking status.');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="customer-name">{item.customer_name}</div>
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
      header: 'Current Status', 
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
          <div className="status-actions">
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
                className={`status-button ${option.value === 'cancelled' ? 'cancel-action' : 'confirm-action'}`}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : (
          <span className="no-actions-label">
            No actions available
          </span>
        );
      }
    },
  ];

  const activeBookings = bookings.filter(booking => 
    booking.status === 'pending' || booking.status === 'confirmed'
  );

  const allBookings = bookings;

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <div className="dashboard-content-wrapper">
          <DashboardHeader title="Manage Appointments" />
          
          {/* <div className="booking-header">
            <h1 className="page-title">Manage Appointments</h1>
            <p className="page-subtitle">
              Confirm, complete, or cancel customer appointments assigned to you.
            </p>
          </div> */}

          {error && (
            <div className="dashboard-error">
              {error}
            </div>
          )}
          
          {success && (
            <div className="dashboard-success">
              {success}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card pending-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'pending').length}</p>
              <p className="stat-label">Pending</p>
            </div>
            <div className="stat-card confirmed-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'confirmed').length}</p>
              <p className="stat-label">Confirmed</p>
            </div>
            <div className="stat-card completed-card">
              <p className="stat-number">{bookings.filter(b => b.status === 'completed').length}</p>
              <p className="stat-label">Completed</p>
            </div>
            <div className="stat-card total-card">
              <p className="stat-number">{bookings.length}</p>
              <p className="stat-label">Total</p>
            </div>
          </div>

          <div className="upcoming-bookings-section">
            <div className="section-header">
              <h2 className="section-title">
                Active Appointments ({activeBookings.length})
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
              </div>
            </div>

            {bookingsLoading ? (
              <div className="dashboard-loading">
                <p>Loading your appointments...</p>
              </div>
            ) : activeBookings.length > 0 ? (
              <Table data={activeBookings} columns={columns} />
            ) : (
              <div className="empty-booking-state">
                <p className="empty-message">No active appointments requiring action.</p>
                <p className="empty-subtext">
                  When customers book appointments with you, they will appear here for you to confirm or manage.
                </p>
              </div>
            )}
          </div>

          {allBookings.length > 0 && (
            <div className="recent-bookings-section">
              <details className="recent-bookings-details">
                <summary className="recent-bookings-summary">
                  All Appointments ({allBookings.length})
                  <span className="dropdown-icon">▼</span>
                </summary>
                <div className="recent-bookings-content">
                  <Table data={allBookings} columns={columns} />
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      {/* Update Status Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Update Appointment Status">
        {selectedBooking && (
          <>
            <div className="modal-booking-info">
              <p className="booking-service">
                Updating status for <strong>{selectedBooking.service_name}</strong>
              </p>
              <p className="booking-detail">
                Customer: <strong>{selectedBooking.customer_name}</strong>
              </p>
              <p className="booking-detail">
                Date: <strong>{formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}</strong>
              </p>
              <p className="booking-detail">
                Current Status: <strong>{selectedBooking.status}</strong>
              </p>
            </div>

            <form onSubmit={handleConfirmUpdate} className="update-status-form">
              <div className="form-group">
                <label htmlFor="new-status">Update Status To</label>
                <select
                  id="new-status"
                  className="form-select"
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
                  <small className="status-description">
                    {getAvailableStatusOptions(selectedBooking.status).find(opt => opt.value === newStatus)?.description}
                  </small>
                )}
              </div>

              {error && (
                <div className="form-error">
                  {error}
                </div>
              )}

              {success && (
                <div className="form-success">
                  {success}
                </div>
              )}

              <div className="modal-actions">
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
    </div>
  );
};

export default UpdateStatus;