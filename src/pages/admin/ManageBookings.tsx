// ✅ Changes made:
// 1) Walk-in phone input now accepts NUMBERS ONLY (digits, optional + at start)
// 2) Date/time display and notification formatting forced to PH timezone (Asia/Manila)
// 3) All "today/max date" logic uses PH date (not device timezone) to avoid mismatch

// src/pages/admin/ManageBookings.tsx - UPDATED (phone numbers only + PH timezone)
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { BookingStatus } from '@models/booking';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';
import { SupabaseNotificationService } from '../../services/supabaseNotificationService';
import "../../assets/styles/dashboards.css";

interface ServiceItem {
  id: number;
  service_name: string;
  price: number;
  duration: number;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface BookingWithRelations {
  id: string;
  serviceId: string;
  serviceName: string;

  // registered user customer
  customerId: string | null;
  customerName: string;
  customerEmail: string;

  // walk-in customer
  walkInCustomerId: string | null;
  walkInCustomerName: string;
  walkInCustomerPhone: string;
  isWalkIn: boolean;

  staffId?: string | null;
  staffName?: string;
  staffEmail?: string;

  startTime: string;
  endTime: string;
  status: BookingStatus;
  price: number;
  notes?: string;

  service_name: string;
  service_price: number;
  service_duration: number;

  customer_name: string;
  customer_email: string;

  staff_name: string;
  staff_email: string;

  booking_date: string;
  booking_time: string;
}

const PH_TZ = 'Asia/Manila';

/**
 * Get YYYY-MM-DD in Philippine timezone, regardless of device timezone.
 */
const getPHDateString = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find(p => p.type === 'year')?.value || '1970';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
};

/**
 * Add days to a YYYY-MM-DD date string (safe, timezone-agnostic by using UTC construction).
 */
const addDaysToYMD = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/**
 * Format booking date+time in Philippine timezone for display.
 */
const formatDisplayDateTimePH = (date: string, time: string) => {
  if (!date) return 'N/A';

  try {
    const [y, m, d] = date.split('-').map(Number);
    const [hh = '0', mm = '0'] = (time || '00:00').split(':');

    // ✅ Build a Date in LOCAL time (not UTC)
    // This avoids the "UTC midnight" bug.
    const local = new Date(y, m - 1, d, Number(hh), Number(mm));

    // ✅ Force display in PH timezone
    return new Intl.DateTimeFormat('en-US', {
      timeZone: PH_TZ,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(local);
  } catch {
    return 'Invalid date';
  }
};

const ManageBookings: React.FC = () => {
  const [bookings, setBookings] = useState<BookingWithRelations[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [servicesList, setServicesList] = useState<ServiceItem[]>([]);

  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const { isOpen, openModal, closeModal } = useModal();

  const [formData, setFormData] = useState<Partial<BookingWithRelations & { bookingDate: string; bookingTime: string }>>({});
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [notificationLoading, setNotificationLoading] = useState<string | null>(null);

  // Mini-modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedBookingForModal, setSelectedBookingForModal] = useState<BookingWithRelations | null>(null);

  
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonType, setReasonType] = useState<'reschedule_request' | 'cancellation_request' | null>(null);
  const [reasonBooking, setReasonBooking] = useState<BookingWithRelations | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');


  const RESCHEDULE_REASONS = [
  'Assigned staff is unavailable',
  'Service requires rescheduling due to schedule conflict',
  'Unexpected emergency / force majeure',
  'Clinic is fully booked for that time',
  'Equipment / room is unavailable',
  'Other (please specify)'
];

const CANCELLATION_REASONS = [
  'Assigned staff is unavailable',
  'Service is temporarily unavailable',
  'Clinic is closed on the selected date',
  'Unexpected emergency / force majeure',
  'Booking cannot be accommodated',
  'Other (please specify)'
];
  // Manual booking modal (walk-in)
  const [showManualBookingModal, setShowManualBookingModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    walkin_name: '',
    walkin_phone_num: '',
    service_id: '',
    staff_id: '',
    booking_date: '',
    booking_time: '',
    notes: ''
  });

  // ✅ PH dates
  const getTodayDate = () => getPHDateString();
  const getMaxDate = () => addDaysToYMD(getPHDateString(), 30);



  const openReasonModal = (booking: BookingWithRelations, type: 'reschedule_request' | 'cancellation_request') => {
  setReasonBooking(booking);
  setReasonType(type);
  setSelectedReason('');
  setCustomReason('');
  setShowReasonModal(true);
};

const closeReasonModal = () => {
  setShowReasonModal(false);
  setReasonType(null);
  setReasonBooking(null);
  setSelectedReason('');
  setCustomReason('');
};
  // Fetch bookings with relations (users + walk-in)
  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services:service_id (service_name, price, duration),
          customers:customer_id (first_name, last_name, email),
          staff:staff_id (first_name, last_name, email),
          walkin:walk_in_customers!bookings_walkin_fk (name, phone_num)
        `)
        .order('booking_date', { ascending: false });

      if (error) throw error;

      const bookingsWithRelations: BookingWithRelations[] = (data || []).map((booking: any) => {
        const isWalkIn = !!booking.walk_in_customer_id;

        const registeredCustomerName = `${booking.customers?.first_name || ''} ${booking.customers?.last_name || ''}`.trim();
        const walkInName = booking.walkin?.name || '';

        const displayCustomerName =
          (isWalkIn ? walkInName : registeredCustomerName) ||
          'Unknown Customer';

        const customerEmail = booking.customers?.email || '';

        return {
          id: booking.id,
          serviceId: booking.service_id,
          serviceName: booking.services?.service_name || 'Unknown Service',

          customerId: booking.customer_id ?? null,
          customerName: displayCustomerName,
          customerEmail: customerEmail,

          walkInCustomerId: booking.walk_in_customer_id ?? null,
          walkInCustomerName: booking.walkin?.name || '',
          walkInCustomerPhone: booking.walkin?.phone_num || '',
          isWalkIn,

          staffId: booking.staff_id ?? null,
          staffName: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
          staffEmail: booking.staff?.email || '',

          startTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
          endTime: booking.booking_date ? `${booking.booking_date}T${booking.booking_time}` : '',
          status: booking.status as BookingStatus,

          price: booking.total_price || booking.services?.price || 0,
          notes: booking.notes || '',

          service_name: booking.services?.service_name || 'Unknown Service',
          service_price: booking.services?.price || 0,
          service_duration: booking.services?.duration || 60,

          customer_name: displayCustomerName,
          customer_email: isWalkIn ? '' : (booking.customers?.email || ''),

          staff_name: booking.staff ? `${booking.staff.first_name || ''} ${booking.staff.last_name || ''}`.trim() : 'Unassigned',
          staff_email: booking.staff?.email || '',

          booking_date: booking.booking_date,
          booking_time: booking.booking_time
        };
      });

      setBookings(bookingsWithRelations);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError(`Failed to load bookings: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch staff
  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email')
        .eq('role', 'staff')
        .order('first_name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      setError(`Failed to load staff members: ${err.message}`);
    }
  };

  // Fetch services
  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, service_name, price, duration')
        .order('service_name');

      if (error) throw error;
      setServicesList((data || []) as ServiceItem[]);
    } catch (err: any) {
      console.error('Error fetching services:', err);
      setError(`Failed to load services: ${err.message}`);
    }
  };

  // ✅ Time slots based on PH time
  const getAvailableTimeSlots = (selectedDate: string) => {
    const slots: string[] = [];
    const startHour = 9;
    const endHour = 18;

    const nowParts = new Intl.DateTimeFormat('en-US', {
      timeZone: PH_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date());

    const currentHour = Number(nowParts.find(p => p.type === 'hour')?.value || 0);
    const currentMinute = Number(nowParts.find(p => p.type === 'minute')?.value || 0);

    const isToday = selectedDate === getTodayDate();

    for (let hour = startHour; hour < endHour; hour++) {
      if (!isToday || hour > currentHour || (hour === currentHour && currentMinute < 30)) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }

      if (hour < endHour - 1) {
        if (!isToday || hour > currentHour || (hour === currentHour && currentMinute <= 30)) {
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
    }

    return slots;
  };

  // Check slot availability for staff
  const isTimeSlotAvailable = async (date: string, time: string, staffId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('staff_id', staffId)
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;
      return (data || []).length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true;
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchStaffMembers();
    fetchServices();

    // init manual booking defaults (PH)
    setManualForm(prev => ({
      ...prev,
      booking_date: getTodayDate(),
      booking_time: ''
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Notifications ----------
 const sendBookingNotification = async (
  booking: BookingWithRelations,
  notificationType: 'reschedule_request' | 'cancellation_request',
  reasonText?: string
) => {
  // Walk-ins cannot receive app notifications
  if (booking.isWalkIn || !booking.customerId) {
    throw new Error(
      'This booking is for a walk-in customer. Notifications are only available for registered users.'
    );
  }

  try {
    setNotificationLoading(booking.id);
    setError(null);

    // ✅ Format booking datetime in PH timezone (Asia/Manila)
    const [hh = '00', mm = '00'] = (booking.booking_time || '00:00').split(':');

    const dtUTC = new Date(
      Date.UTC(
        Number(booking.booking_date.slice(0, 4)),
        Number(booking.booking_date.slice(5, 7)) - 1,
        Number(booking.booking_date.slice(8, 10)),
        Number(hh),
        Number(mm)
      )
    );

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      timeZone: PH_TZ,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dtUTC);

    const formattedTime = new Intl.DateTimeFormat('en-US', {
      timeZone: PH_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(dtUTC);

    const formattedDateTime = `${formattedDate} at ${formattedTime}`;

    // ✅ Optional reason block (markdown-friendly)
    const reasonBlock =
      reasonText && reasonText.trim()
        ? `**Reason:** ${reasonText.trim()}\n\n`
        : '';

    const notificationData: any = {
      user_id: booking.customerId,
      booking_id: booking.id,
      type: notificationType,
      title: '',
      message: '',
      read: false,
      created_at: new Date().toISOString()
    };

    // ✅ Build title + message (include reason if provided)
    switch (notificationType) {
      case 'reschedule_request':
        notificationData.title = '🔁 Action Required: Reschedule Your Appointment';
        notificationData.message = `Your booking for **${booking.service_name}** on **${formattedDateTime}** needs to be rescheduled.

${reasonBlock}Please choose a new date and time that works for you.

If you have any questions, please contact our support team.`;
        break;

      case 'cancellation_request':
        notificationData.title = '⚠️ Action Required: Confirm Cancellation';
        notificationData.message = `Your booking for **${booking.service_name}** on **${formattedDateTime}** cannot be confirmed as scheduled.

${reasonBlock}Please cancel this booking or contact our support team to discuss alternative options.

We apologize for any inconvenience.`;
        break;
    }

    // ✅ Insert notification
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([notificationData]);

    if (notificationError) throw notificationError;

    // ✅ Touch booking updated_at (optional, but keeps UI in sync)
    const { error: touchError } = await supabase
      .from('bookings')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', booking.id);

    if (touchError) throw touchError;

    return true;
  } finally {
    setNotificationLoading(null);
  }
};

const requestCustomerReschedule = async (booking: BookingWithRelations, reason?: string) => {
  try {
    await sendBookingNotification(booking, 'reschedule_request', reason);
    setSuccessMessage(
      `✅ ${booking.customer_name} has been notified to reschedule their ${booking.service_name} appointment.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  } catch (err: any) {
    setError(`Failed to request reschedule: ${err.message}`);
  }
};

const requestCustomerCancellation = async (booking: BookingWithRelations, reason?: string) => {
  try {
    await sendBookingNotification(booking, 'cancellation_request', reason);
    setSuccessMessage(
      `✅ ${booking.customer_name} has been notified to cancel their ${booking.service_name} appointment.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  } catch (err: any) {
    setError(`Failed to request cancellation: ${err.message}`);
  }
};

  const sendAutomaticNotification = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      if (newStatus === 'confirmed') {
        await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_confirmed');
      } else if (newStatus === 'completed') {
        await SupabaseNotificationService.createBookingNotification(bookingId, 'booking_completed');
      }
      return true;
    } catch (error) {
      console.error('❌ Error sending automatic notification:', error);
      return false;
    }
  };

  // ---------- Edit booking ----------
  const handleEditClick = (booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setFormData({
      ...booking,
      bookingDate: booking.booking_date || '',
      bookingTime: booking.booking_time || '',
      staffId: booking.staffId || ''
    });
    setModalError(null);
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setModalError(null);
  };

  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, bookingDate: date, bookingTime: '' }));
    setModalError(null);
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const staffId = e.target.value;
    setFormData(prev => ({ ...prev, staffId, bookingTime: '' }));
    setModalError(null);
  };

  const isActiveBooking = (status: BookingStatus) => status === 'pending' || status === 'confirmed';

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setLoading(true);
    setError(null);
    setModalError(null);

    try {
      const todayPH = getTodayDate();
      if (formData.bookingDate && formData.bookingDate < todayPH) {
        setModalError('Cannot book appointments in the past. Please select today or a future date.');
        return;
      }

      if (formData.bookingDate && formData.bookingTime && formData.staffId) {
        const isAvailable = await isTimeSlotAvailable(formData.bookingDate, formData.bookingTime, formData.staffId);
        if (!isAvailable) {
          setModalError('This time slot is no longer available for the selected staff member. Please choose another time or staff member.');
          return;
        }
      }

      const newStatus = (formData.status || selectedBooking.status) as BookingStatus;
      const updateData: any = {
        staff_id: formData.staffId === '' ? null : formData.staffId,
        booking_date: formData.bookingDate || selectedBooking.booking_date,
        booking_time: formData.bookingTime || selectedBooking.booking_time,
        status: newStatus,
        notes: formData.notes || selectedBooking.notes,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', selectedBooking.id);

      if (error) throw error;

      const statusChanged = newStatus !== selectedBooking.status;
      let notificationSent = false;

      if (!selectedBooking.isWalkIn && statusChanged && (newStatus === 'confirmed' || newStatus === 'completed')) {
        notificationSent = await sendAutomaticNotification(selectedBooking.id, newStatus);
      }

      setSuccessMessage(
        notificationSent
          ? `Booking updated successfully! Customer notified about ${newStatus} status.`
          : 'Booking updated successfully'
      );

      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
      closeModal();
    } catch (err: any) {
      setModalError(`Failed to update booking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      setSuccessMessage('Booking deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
    } catch (err: any) {
      setError(`Failed to delete booking: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      setLoading(true);
      setError(null);

      const currentBooking = bookings.find(b => b.id === bookingId);
      const statusChanged = currentBooking && currentBooking.status !== newStatus;

      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      let notificationSent = false;
      if (currentBooking && !currentBooking.isWalkIn && statusChanged && (newStatus === 'confirmed' || newStatus === 'completed')) {
        notificationSent = await sendAutomaticNotification(bookingId, newStatus);
      }

      setSuccessMessage(
        notificationSent
          ? `Booking status updated to ${newStatus}! Customer notified.`
          : `Booking status updated to ${newStatus}`
      );

      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchBookings();
      setShowStatusModal(false);
    } catch (err: any) {
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Manual booking (walk-in) ----------
  const openManualBookingModal = () => {
    setModalError(null);
    setManualForm({
      walkin_name: '',
      walkin_phone_num: '',
      service_id: '',
      staff_id: '',
      booking_date: getTodayDate(),
      booking_time: '',
      notes: ''
    });
    setShowManualBookingModal(true);
  };

  


  // ✅ phone sanitizer: keep digits only (optionally allow leading +)
  const sanitizePhone = (raw: string) => {
    // If you want STRICT digits only, use: raw.replace(/\D/g, '')
    // This version allows an optional leading '+' then digits.
    let cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.includes('+')) {
      cleaned = cleaned.replace(/\+/g, '');
      cleaned = '+' + cleaned; // only one leading +
    }
    return cleaned;
  };

  const handleCreateManualBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setModalError(null);
    setError(null);

    try {
      if (!manualForm.walkin_name.trim()) throw new Error('Walk-in name is required.');
      if (!manualForm.walkin_phone_num.trim()) throw new Error('Phone number is required.');
      if (!manualForm.service_id) throw new Error('Please select a service.');
      if (!manualForm.booking_date) throw new Error('Please select a booking date.');
      if (!manualForm.booking_time) throw new Error('Please select a booking time.');

      if (manualForm.staff_id) {
        const isAvailable = await isTimeSlotAvailable(manualForm.booking_date, manualForm.booking_time, manualForm.staff_id);
        if (!isAvailable) throw new Error('This time slot is not available for the selected staff member.');
      }

      const { data: walkinData, error: walkinError } = await supabase
        .from('walk_in_customers')
        .insert([{
          name: manualForm.walkin_name.trim(),
          phone_num: sanitizePhone(manualForm.walkin_phone_num.trim()),
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (walkinError) throw walkinError;

      const selectedService = servicesList.find(s => String(s.id) === manualForm.service_id);
      const totalPrice = selectedService?.price ?? 0;

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          service_id: Number(manualForm.service_id),
          customer_id: null,
          walk_in_customer_id: walkinData.id,
          staff_id: manualForm.staff_id ? manualForm.staff_id : null,
          booking_date: manualForm.booking_date,
          booking_time: manualForm.booking_time,
          status: 'pending',
          total_price: totalPrice,
          notes: manualForm.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (bookingError) throw bookingError;

      setSuccessMessage('✅ Manual booking created successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);

      setShowManualBookingModal(false);
      await fetchBookings();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create manual booking.');
    } finally {
      setLoading(false);
    }
  };

  // Mini modals handlers
  const handleStatusButtonClick = (booking: BookingWithRelations) => {
    setSelectedBookingForModal(booking);
    setShowStatusModal(true);
  };

  const handleNotificationButtonClick = (booking: BookingWithRelations) => {
    setSelectedBookingForModal(booking);
    setShowNotificationModal(true);
  };

  const handleCloseModals = () => {
    setShowStatusModal(false);
    setShowNotificationModal(false);
    setSelectedBookingForModal(null);
  };

  const columns = [
    {
      header: 'Service',
      key: 'service',
      render: (item: BookingWithRelations) => (
        <div className="service-info-container">
          <div className="service-name">{item.service_name}</div>
          <div className="service-price-duration">
            <span>{formatCurrency(item.service_price)}</span>
            <span>•</span>
            <span>{item.service_duration}min</span>
          </div>
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: BookingWithRelations, b: BookingWithRelations) => a.service_name.localeCompare(b.service_name)
    },
    {
      header: 'Customer',
      key: 'customer',
      render: (item: BookingWithRelations) => (
        <div className="customer-info-container">
          <div className="customer-name">
            {item.customer_name}
            {item.isWalkIn && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>(Walk-in)</span>
            )}
          </div>
          {!item.isWalkIn ? (
            <div className="customer-email">{item.customer_email}</div>
          ) : (
            <div className="customer-email">{item.walkInCustomerPhone}</div>
          )}
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: BookingWithRelations, b: BookingWithRelations) => a.customer_name.localeCompare(b.customer_name)
    },
    {
      header: 'Staff',
      key: 'staff',
      render: (item: BookingWithRelations) => (
        <div className="staff-info-container">
          <div className="staff-name">{item.staff_name}</div>
          {item.staff_email && <div className="staff-email">{item.staff_email}</div>}
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: BookingWithRelations, b: BookingWithRelations) => (a.staff_name || '').localeCompare(b.staff_name || '')
    },
    {
      header: 'Date & Time',
      key: 'datetime',
      // ✅ PH timezone display
      render: (item: BookingWithRelations) => (
        <div className="booking-datetime-container">
          <div className="booking-date-time">
            {formatDisplayDateTimePH(item.booking_date, item.booking_time)}
          </div>
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: BookingWithRelations, b: BookingWithRelations) => {
        const dateA = new Date(`${a.booking_date}T${a.booking_time}`);
        const dateB = new Date(`${b.booking_date}T${b.booking_time}`);
        return dateA.getTime() - dateB.getTime();
      }
    },
    {
      header: 'Status',
      key: 'status',
      render: (item: BookingWithRelations) => (
        <div className="booking-status-container">
          <span className={`booking-status-badge booking-status-badge-${item.status}`}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: BookingWithRelations, b: BookingWithRelations) => {
        const statusOrder: Record<string, number> = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
        const aOrder = statusOrder[a.status.toLowerCase()] ?? 999;
        const bOrder = statusOrder[b.status.toLowerCase()] ?? 999;
        return aOrder - bOrder;
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: BookingWithRelations) => {
        const isActive = item.status === 'pending' || item.status === 'confirmed';
        const isNotificationLoading = notificationLoading === item.id;
        const notifyDisabled = isNotificationLoading || item.isWalkIn;

        return (
          <div className="booking-actions-container">
            {isActive ? (
              <>
                <Button
                  variant="text"
                  className="stacked-button stacked-edit-button"
                  onClick={() => {
                    setSelectedBooking(item);
                    setFormData({
                      ...item,
                      bookingDate: item.booking_date || '',
                      bookingTime: item.booking_time || '',
                      staffId: item.staffId || ''
                    });
                    setModalError(null);
                    openModal();
                  }}
                  title="Edit booking"
                >
                  Edit
                </Button>

                <Button
                  variant="text"
                  className="stacked-button stacked-delete-button"
                  onClick={() => handleDelete(item.id)}
                  title="Delete booking"
                >
                  Delete
                </Button>

                <Button
                  variant="text"
                  className="stacked-button stacked-status-button"
                  onClick={() => handleStatusButtonClick(item)}
                  title="Change booking status"
                >
                  Status
                </Button>

                <Button
                  variant="text"
                  className="stacked-button stacked-notify-button"
                  onClick={() => handleNotificationButtonClick(item)}
                  disabled={notifyDisabled}
                  title={item.isWalkIn ? 'Walk-in bookings have no app notification' : 'Send notifications to customer'}
                >
                  {isNotificationLoading ? 'Sending...' : 'Notify'}
                </Button>
              </>
            ) : (
              <div className="readonly-actions">
                <Button
                  variant="text"
                  className="stacked-button stacked-delete-button readonly"
                  onClick={() => handleDelete(item.id)}
                  title="Delete booking"
                >
                  Delete
                </Button>
                <span className="read-only-text">Read-only</span>
              </div>
            )}
          </div>
        );
      },
      searchable: false,
      sortable: false
    }
  ];

  const availableTimeSlots = formData.bookingDate ? getAvailableTimeSlots(formData.bookingDate) : [];
  const manualTimeSlots = manualForm.booking_date ? getAvailableTimeSlots(manualForm.booking_date) : [];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Manage Bookings" />

        <div className="dashboard-content-wrapper">
          {successMessage && <div className="inventory-success-message">{successMessage}</div>}

          {loading && !isOpen && (
            <div className="dashboard-loading">
              <p>Loading bookings...</p>
            </div>
          )}

          {error && (
            <div className="dashboard-error">
              {error}
              <div className="dashboard-error-actions">
                <Button variant="text" size="small" onClick={fetchBookings} style={{ fontSize: '14px' }}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <div className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">Bookings ({bookings.length})</h3>

              <div className="bookings-header-actions">
                <Button variant="secondary" onClick={fetchBookings} disabled={loading} size="small">
                  🔄 Refresh Bookings
                </Button>

                <Button variant="primary" onClick={openManualBookingModal} disabled={loading} size="small">
                  ➕ Manual Booking
                </Button>
              </div>
            </div>

            {bookings.length > 0 ? (
              <Table
                data={bookings}
                columns={columns}
                emptyMessage="No bookings found. Bookings will appear here when customers make appointments."
                searchPlaceholder="Search bookings by service, customer, staff, date, or status..."
                showSearch={true}
                showPagination={true}
              />
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">No bookings found.</p>
                <p className="empty-state-subtext">Bookings will appear here when customers make appointments.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* Main Edit Booking Modal */}
      {/* ========================= */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Edit Booking">
        {selectedBooking && (
          <form onSubmit={handleUpdateBooking} className="contact-form">
            <div className="form-group">
              <label htmlFor="serviceName">Service</label>
              <input type="text" id="serviceName" name="serviceName" value={selectedBooking.service_name || ''} disabled />
            </div>

            <div className="form-group">
              <label htmlFor="servicePrice">Price</label>
              <input type="text" id="servicePrice" name="servicePrice" value={formatCurrency(selectedBooking.service_price || 0)} disabled />
            </div>

            <div className="form-group">
              <label htmlFor="customerName">Customer</label>
              <input type="text" id="customerName" name="customerName" value={selectedBooking.customer_name || ''} disabled />
            </div>

            <div className="form-group">
              <label htmlFor="staffId">Assign Staff</label>
              <select
                id="staffId"
                name="staffId"
                value={(formData.staffId as any) || ''}
                onChange={handleStaffChange}
                disabled={!(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed')}
              >
                <option value="">Unassigned</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name} {staff.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bookingDate">Booking Date *</label>
              <input
                type="date"
                id="bookingDate"
                name="bookingDate"
                value={formData.bookingDate || ''}
                onChange={(e) => handleDateChange(e.target.value)}
                required
                min={getTodayDate()}
                max={getMaxDate()}
                disabled={!(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed')}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bookingTime">Booking Time *</label>
              <select
                id="bookingTime"
                name="bookingTime"
                value={formData.bookingTime || ''}
                onChange={handleChange}
                required
                disabled={!(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed') || !formData.bookingDate}
              >
                <option value="">
                  {!formData.bookingDate
                    ? 'Select a date first'
                    : availableTimeSlots.length === 0
                      ? 'No available time slots'
                      : 'Select a time'}
                </option>
                {availableTimeSlots.map(time => (
                  <option key={time} value={time}>
                    {parseInt(time.split(':')[0], 10) >= 12 ? `${time} PM` : `${time} AM`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={(formData.status as any) || ''}
                onChange={handleChange}
                required
                disabled={!(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed')}
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={(formData.notes as any) || ''}
                onChange={handleChange}
                rows={3}
                placeholder="Add any notes about this booking..."
                disabled={!(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed')}
              />
            </div>

            {modalError && <div className="auth-error-message">{modalError}</div>}

            <div className="modal-actions">
              <Button variant="secondary" onClick={closeModal} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading || !(selectedBooking.status === 'pending' || selectedBooking.status === 'confirmed')}>
                {loading ? 'Updating...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================= */}
      {/* Manual Booking Modal */}
      {/* ========================= */}
      <Modal
        isOpen={showManualBookingModal}
        onClose={() => setShowManualBookingModal(false)}
        title="Manual Booking (Walk-in)"
      >
        <form onSubmit={handleCreateManualBooking} className="contact-form">
          <div className="form-grid-2">
            <div className="form-group">
              <label>Walk-in Name *</label>
              <input
                type="text"
                value={manualForm.walkin_name}
                onChange={(e) => setManualForm(prev => ({ ...prev, walkin_name: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="^\+?\d*$"
                value={manualForm.walkin_phone_num}
                onChange={(e) => {
                  const cleaned = sanitizePhone(e.target.value);
                  setManualForm(prev => ({ ...prev, walkin_phone_num: cleaned }));
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  const cleaned = sanitizePhone(text);
                  setManualForm(prev => ({ ...prev, walkin_phone_num: cleaned }));
                }}
                required
                placeholder="09xxxxxxxxx"
              />
              <small style={{ opacity: 0.75 }}>
                Numbers only. Optional leading “+” is allowed.
              </small>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Service *</label>
              <select
                value={manualForm.service_id}
                onChange={(e) => setManualForm(prev => ({ ...prev, service_id: e.target.value }))}
                required
              >
                <option value="">Select service</option>
                {servicesList.map(s => (
                  <option key={s.id} value={String(s.id)}>
                    {s.service_name} ({formatCurrency(s.price)} • {s.duration}min)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Assign Staff</label>
              <select
                value={manualForm.staff_id}
                onChange={(e) => setManualForm(prev => ({ ...prev, staff_id: e.target.value }))}
              >
                <option value="">Unassigned</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.first_name} {staff.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Booking Date *</label>
              <input
                type="date"
                value={manualForm.booking_date}
                onChange={(e) => setManualForm(prev => ({ ...prev, booking_date: e.target.value, booking_time: '' }))}
                min={getTodayDate()}
                max={getMaxDate()}
                required
              />
            </div>

            <div className="form-group">
              <label>Booking Time *</label>
              <select
                value={manualForm.booking_time}
                onChange={(e) => setManualForm(prev => ({ ...prev, booking_time: e.target.value }))}
                required
              >
                <option value="">
                  {manualForm.booking_date ? 'Select a time' : 'Select a date first'}
                </option>
                {manualTimeSlots.map(time => (
                  <option key={time} value={time}>
                    {parseInt(time.split(':')[0], 10) >= 12 ? `${time} PM` : `${time} AM`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows={3}
              value={manualForm.notes}
              onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes (optional)"
            />
          </div>

          {modalError && <div className="auth-error-message">{modalError}</div>}

          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowManualBookingModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Booking'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
  isOpen={showReasonModal}
  onClose={closeReasonModal}
  title={reasonType === 'reschedule_request' ? 'Reason for Reschedule' : 'Reason for Cancellation'}
>
 <div className="contact-form reason-modal">
    <p style={{ marginBottom: 12, opacity: 0.85 }}>
      Select a reason for notifying <strong>{reasonBooking?.customer_name}</strong>.
    </p>

    <div className="form-group">
      <label>Reason *</label>

  <div className="reason-options">
  {(reasonType === 'reschedule_request' ? RESCHEDULE_REASONS : CANCELLATION_REASONS).map((r) => (
    <label key={r} className="reason-option">
      <input
        type="radio"
        name="reason"
        value={r}
        checked={selectedReason === r}
        onChange={(e) => setSelectedReason(e.target.value)}
      />
      <span className="reason-text">{r}</span>
    </label>
  ))}
</div>
    </div>

    {selectedReason === 'Other (please specify)' && (
      <div className="form-group">
        <label>Custom Reason *</label>
        <textarea
          rows={3}
          value={customReason}
          onChange={(e) => setCustomReason(e.target.value)}
          placeholder="Type the reason here..."
        />
      </div>
    )}

    <div className="modal-actions">
      <Button variant="secondary" onClick={closeReasonModal}>
        Cancel
      </Button>

      <Button
        variant="primary"
        disabled={
          !reasonBooking ||
          !reasonType ||
          !selectedReason ||
          (selectedReason === 'Other (please specify)' && !customReason.trim())
        }
        onClick={async () => {
          if (!reasonBooking || !reasonType) return;

          const reasonText =
            selectedReason === 'Other (please specify)'
              ? customReason.trim()
              : selectedReason;

          setShowReasonModal(false);

          if (reasonType === 'reschedule_request') {
            await requestCustomerReschedule(reasonBooking, reasonText);
          } else {
            await requestCustomerCancellation(reasonBooking, reasonText);
          }
        }}
      >
        Send Notification
      </Button>
    </div>
  </div>
</Modal>

      {/* Mini modals (Status / Notifications) stay the same except DateTime display uses PH formatter in table already */}
      {showStatusModal && selectedBookingForModal && (
        <div className="mini-modal-overlay" onClick={handleCloseModals}>
          <div className="mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mini-modal-header">
              <h3>Change Booking Status</h3>
              <button className="mini-modal-close" onClick={handleCloseModals}>×</button>
            </div>
            <div className="mini-modal-content">
              <p className="mini-modal-description">
                Update status for <strong>{selectedBookingForModal.customer_name}'s</strong> booking:
                <br />
                <em>{selectedBookingForModal.service_name}</em>
              </p>
              <div className="mini-modal-options">
                {selectedBookingForModal.status !== 'confirmed' && (
                  <button
                    className="mini-modal-option confirm"
                    onClick={() => handleStatusUpdate(selectedBookingForModal.id, 'confirmed')}
                    disabled={loading}
                  >
                    <span className="option-icon">✓</span>
                    <span className="option-text">Confirm Booking</span>
                  </button>
                )}
                {selectedBookingForModal.status !== 'completed' && (
                  <button
                    className="mini-modal-option complete"
                    onClick={() => handleStatusUpdate(selectedBookingForModal.id, 'completed')}
                    disabled={loading}
                  >
                    <span className="option-icon">✓</span>
                    <span className="option-text">Mark as Completed</span>
                  </button>
                )}
                {selectedBookingForModal.status !== 'cancelled' && (
                  <button
                    className="mini-modal-option cancel"
                    onClick={() => handleStatusUpdate(selectedBookingForModal.id, 'cancelled')}
                    disabled={loading}
                  >
                    <span className="option-icon">✗</span>
                    <span className="option-text">Cancel Booking</span>
                  </button>
                )}
              </div>
            </div>
            <div className="mini-modal-footer">
              <Button variant="secondary" onClick={handleCloseModals}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {showNotificationModal && selectedBookingForModal && (
        <div className="mini-modal-overlay" onClick={handleCloseModals}>
          <div className="mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mini-modal-header">
              <h3>Send Notification</h3>
              <button className="mini-modal-close" onClick={handleCloseModals}>×</button>
            </div>
            <div className="mini-modal-content">
              <p className="mini-modal-description">
                Send notification to <strong>{selectedBookingForModal.customer_name}</strong> about:
                <br />
                <em>{selectedBookingForModal.service_name}</em>
              </p>

              {selectedBookingForModal.isWalkIn ? (
                <div className="auth-error-message">
                  Walk-in bookings have no app account, so notifications are not available.
                </div>
              ) : (
                <div className="mini-modal-options">
                 <button
                  className="mini-modal-option reschedule"
                  onClick={() => {
                    openReasonModal(selectedBookingForModal, 'reschedule_request');
                    handleCloseModals();
                  }}
                  disabled={notificationLoading === selectedBookingForModal.id}
                >
                    <span className="option-icon">🔄</span>
                    <span className="option-text">Request Reschedule</span>
                  </button>

                                  <button
                    className="mini-modal-option cancel-notify"
                    onClick={() => {
                      openReasonModal(selectedBookingForModal, 'cancellation_request');
                      handleCloseModals();
                    }}
                    disabled={notificationLoading === selectedBookingForModal.id}
                  >

                    <span className="option-icon">⚠️</span>
                    <span className="option-text">Request Cancellation</span>
                  </button>
                </div>
              )}
            </div>
            <div className="mini-modal-footer">
              <Button variant="secondary" onClick={handleCloseModals}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageBookings;
