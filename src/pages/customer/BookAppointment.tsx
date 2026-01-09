// src/pages/customer/BookAppointment.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Button from '@components/common/Button';
import { Service } from '@models/service';
import { useAuth } from '@context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import '../../assets/styles/customerdashboards.css';

// ✅ Helper: Format prices in PHP currency
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

// Interface for staff data from database
interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

// Interface for preselected service
interface PreselectedService {
  id: string | number;
  name: string;
  price: number;
  duration: number;
  category: string;
}

const BookAppointment: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState<string>(''); // HH:MM
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get preselected service from navigation state
  const preselectedService = location.state?.preselectedService as PreselectedService;

  // Fetch available services from Supabase
  const fetchServices = async () => {
    try {
      setServicesLoading(true);
      console.log('🔄 Fetching services from Supabase...');
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('service_name');

      if (error) {
        console.error('❌ Error fetching services:', error);
        throw error;
      }

      console.log('✅ Services fetched from database:', data);

      // Transform data to match Service interface - ensure IDs are strings
      const transformedServices: Service[] = (data || []).map(service => ({
        id: service.id.toString(), // Convert ID to string
        name: service.service_name,
        description: service.description,
        price: parseFloat(service.price),
        durationMinutes: service.duration,
        category: service.category,
        imageUrl: service.service_img
      }));

      console.log('✅ Transformed services:', transformedServices);
      setServices(transformedServices);
    } catch (err: any) {
      console.error('❌ Error fetching services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setServicesLoading(false);
    }
  };

  // Fetch available staff members from Supabase
  const fetchStaffMembers = async () => {
    try {
      setStaffLoading(true);
      console.log('🔄 Fetching staff members from Supabase...');
      
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('role', 'staff')
        .order('first_name');

      if (error) {
        console.error('❌ Error fetching staff members:', error);
        throw error;
      }

      // Ensure staff IDs are strings
      const staffWithStringIds = (data || []).map(staff => ({
        ...staff,
        id: staff.id.toString() // Convert ID to string
      }));

      console.log('✅ Staff members fetched:', staffWithStringIds);
      setStaffMembers(staffWithStringIds);
    } catch (err: any) {
      console.error('❌ Error fetching staff members:', err);
      setError('Failed to load staff members. Please try again.');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    fetchStaffMembers();
  }, []);

  // Auto-select the preselected service when services are loaded
  useEffect(() => {
    if (preselectedService && services.length > 0 && !servicesLoading) {
      console.log('🎯 Auto-selecting service:', preselectedService);
      console.log('🔍 Looking for service ID:', preselectedService.id, 'Type:', typeof preselectedService.id);
      console.log('📋 Available services:', services.map(s => ({ id: s.id, type: typeof s.id, name: s.name })));
      
      // Convert both IDs to strings for comparison to handle number vs string IDs
      const preselectedId = preselectedService.id.toString();
      console.log('🔄 Converted preselected ID to string:', preselectedId);
      
      // Find the matching service
      const matchedService = services.find(service => service.id === preselectedId);
      if (matchedService) {
        console.log('✅ Found matching service:', matchedService.name);
        setSelectedServiceId(matchedService.id);
      } else {
        console.warn('❌ No matching service found for ID:', preselectedId);
        console.log('🔍 Available IDs:', services.map(s => s.id));
      }
    }
  }, [preselectedService, services, servicesLoading]);

  // Get available time slots based on whether it's today or future date
  const getAvailableTimeSlots = () => {
    const slots = [];
    const startHour = 9; // 9 AM
    const endHour = 18; // 6 PM
    
    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Check if selected date is today
    const isToday = selectedDate === now.toISOString().split('T')[0];
    
    for (let hour = startHour; hour < endHour; hour++) {
      // For 00 minute slot
      if (!isToday || hour > currentHour || (hour === currentHour && currentMinute < 30)) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
      }
      
      // For 30 minute slot (except for the last hour)
      if (hour < endHour - 1) {
        if (!isToday || hour > currentHour || (hour === currentHour && currentMinute <= 30)) {
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
      }
    }
    
    return slots;
  };

  // Check if a time slot is available for the selected staff
  const isTimeSlotAvailable = async (date: string, time: string, duration: number, staffId: string): Promise<boolean> => {
    try {
      // Check for overlapping bookings for this staff member
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('booking_date', date)
        .eq('booking_time', time)
        .eq('staff_id', staffId)
        .in('status', ['pending', 'confirmed']);

      if (error) throw error;

      // If no bookings found at this time for this staff, it's available
      return data.length === 0;
    } catch (err) {
      console.error('Error checking time slot:', err);
      return true; // Default to available if check fails
    }
  };

  // Get staff members specialized in the selected service category
  const getSpecializedStaff = (serviceCategory: string) => {
    if (!serviceCategory) return staffMembers;
    
    // You can customize this logic based on your staff specializations
    // For now, we'll return all staff, but you could add a specialization field to users table
    return staffMembers;
  };

  const handleServiceChange = (serviceId: string) => {
    console.log('🔄 Service changed to:', serviceId);
    console.log('📋 Available services:', services);
    
    setSelectedServiceId(serviceId);
    // Reset staff selection when service changes
    setSelectedStaffId('');
  };

  // Handle date change - reset time if needed
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    
    // If the selected time is no longer valid for the new date, reset it
    if (date && selectedTime) {
      const timeSlots = getAvailableTimeSlots();
      if (!timeSlots.includes(selectedTime)) {
        setSelectedTime('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔄 Form submitted with:', {
      selectedServiceId,
      selectedStaffId,
      selectedDate,
      selectedTime,
      services
    });

    if (!selectedServiceId || !selectedStaffId || !selectedDate || !selectedTime || !user) {
      setError('Please select a service, staff member, date, and time.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Use string comparison to ensure type consistency
    const selectedService = services.find(s => s.id === selectedServiceId);
    const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);

    console.log('🔍 Looking for service with ID:', selectedServiceId, 'Type:', typeof selectedServiceId);
    console.log('📋 Available service IDs:', services.map(s => `${s.id} (${typeof s.id})`));
    console.log('✅ Found service:', selectedService);
    console.log('✅ Found staff:', selectedStaff);

    if (!selectedService) {
      console.error('❌ Service not found for ID:', selectedServiceId);
      setError('Selected service not found. Please refresh the page and try again.');
      setLoading(false);
      return;
    }

    if (!selectedStaff) {
      setError('Selected staff member not found.');
      setLoading(false);
      return;
    }

    try {
      // Check if the time slot is still available for the selected staff
      const isAvailable = await isTimeSlotAvailable(
        selectedDate, 
        selectedTime, 
        selectedService.durationMinutes, 
        selectedStaffId
      );
      
      if (!isAvailable) {
        setError('This time slot is no longer available for the selected staff member. Please choose another time or staff member.');
        setLoading(false);
        return;
      }

      // Create booking in Supabase - ensure we use the correct ID types
      const bookingData = {
        service_id: selectedServiceId, // This should match your database type
        customer_id: user.id,
        staff_id: selectedStaffId,
        booking_date: selectedDate,
        booking_time: selectedTime,
        status: 'pending',
        total_price: selectedService.price,
        notes: notes || null,
        created_at: new Date().toISOString()
      };

      console.log('📤 Creating booking with data:', bookingData);

      const { data, error } = await supabase
        .from('bookings')
        .insert([bookingData])
        .select();

      if (error) {
        console.error('❌ Booking creation error:', error);
        throw error;
      }

      console.log('✅ Booking created successfully:', data);
      setSuccess(`Appointment booked successfully with ${selectedStaff.first_name} ${selectedStaff.last_name}! You will receive a confirmation soon.`);
      
      // Redirect after success
      setTimeout(() => navigate('/customer/manage-bookings'), 3000);
    } catch (err: any) {
      console.error('❌ Booking error:', err);
      setError(err.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);
  const specializedStaff = getSpecializedStaff(selectedService?.category || '');
  const availableTimeSlots = getAvailableTimeSlots();

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Book a New Appointment" />
        
        <div className="dashboard-content-wrapper">
          <div className="booking-header">
            <h1 className="page-title">Schedule Your Appointment</h1>
            {/* <p className="page-subtitle">
              Choose your desired service, preferred staff member, date, and time to schedule your next visit.
            </p> */}
          </div>

          {/* Show preselected service notification */}
          {preselectedService && selectedService && (
            <div className="preselected-notification">
              <strong>Service Pre-selected:</strong> {preselectedService.name} has been automatically selected for you.
            </div>
          )}

          {/* Loading State */}
          {(servicesLoading || staffLoading) ? (
            <div className="booking-loading">
              <div className="loading-spinner"></div>
              <p>Loading available options...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="no-services-state">
              <p>No services available at the moment. Please check back later.</p>
              <Button variant="secondary" onClick={fetchServices} className="retry-button">
                Retry Loading Services
              </Button>
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="no-staff-state">
              <p>No staff members available at the moment. Please check back later.</p>
            </div>
          ) : (
            <div className="booking-form-container">
              <form className="booking-form" onSubmit={handleSubmit}>
                {/* Service Selection */}
                <div className="form-group">
                  <label htmlFor="service">Select Service *</label>
                  <select
                    id="service"
                    value={selectedServiceId}
                    onChange={(e) => handleServiceChange(e.target.value)}
                    required
                    className="form-select"
                  >
                    <option value="">-- Choose a Service --</option>
                    {services.map(service => (
                      <option key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(service.price)} ({service.durationMinutes} min)
                      </option>
                    ))}
                  </select>
                  <small className="form-note">
                    {services.length} services available
                    {preselectedService && selectedService && ` • "${preselectedService.name}" is pre-selected`}
                  </small>
                </div>

                {/* Service Details Display */}
                {selectedService && (
                  <div className="service-details-card">
                    <h4 className="service-name">
                      {selectedService.name}
                    </h4>
                    <p className="service-description">
                      {selectedService.description}
                    </p>
                    <div className="service-meta">
                      <span className="service-price">
                        Price: {formatCurrency(selectedService.price)}
                      </span>
                      <span className="service-duration">
                        Duration: {selectedService.durationMinutes} minutes
                      </span>
                      <span className="service-category">
                        Category: {selectedService.category}
                      </span>
                    </div>
                  </div>
                )}

                {/* Staff Selection */}
                <div className="form-group">
                  <label htmlFor="staff">Select Preferred Staff *</label>
                  <select
                    id="staff"
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    required
                    disabled={!selectedServiceId}
                    className="form-select"
                  >
                    <option value="">
                      -- {selectedServiceId ? 'Choose a Staff Member' : 'Select a service first'} --
                    </option>
                    {specializedStaff.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.first_name} {staff.last_name}
                      </option>
                    ))}
                  </select>
                  <small className="form-note">
                    {selectedServiceId 
                      ? `Choose from our available ${selectedService?.category} specialists`
                      : 'Please select a service first to see available staff'
                    }
                  </small>
                </div>

                {/* Staff Details Display */}
                {selectedStaff && (
                  <div className="staff-details-card">
                    <h4 className="staff-name">
                      {selectedStaff.first_name} {selectedStaff.last_name}
                    </h4>
                    <div className="staff-role">
                      Professional beauty and wellness specialist
                    </div>
                  </div>
                )}

                {/* Date Selection */}
                <div className="form-group">
                  <label htmlFor="date">Preferred Date *</label>
                  <input
                    type="date"
                    id="date"
                    value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                    className="form-input"
                    min={new Date().toISOString().split('T')[0]} // Prevent past dates
                    max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} // 30 days in future
                  />
                </div>

                {/* Time Selection */}
                <div className="form-group">
                  <label htmlFor="time">Preferred Time *</label>
                  <select
                    id="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    required
                    disabled={!selectedDate}
                    className="form-select"
                  >
                    <option value="">
                      -- {selectedDate ? 'Select a Time' : 'Select a date first'} --
                    </option>
                    {availableTimeSlots.map(time => (
                      <option key={time} value={time}>
                        {parseInt(time.split(':')[0]) >= 12 
                          ? `${time} PM` 
                          : `${time} AM`
                        }
                      </option>
                    ))}
                  </select>
                  <small className="form-note">
                    {selectedDate === new Date().toISOString().split('T')[0] 
                      ? `Today's available time slots (current time: ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')})`
                      : 'Business hours: 9:00 AM - 6:00 PM'
                    }
                  </small>
                  {selectedDate && availableTimeSlots.length === 0 && (
                    <small className="form-error-note">
                      No available time slots for the selected date. Please choose another date.
                    </small>
                  )}
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="notes">Special Requests or Notes (Optional)</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any special requirements, allergies, or preferences..."
                    className="form-textarea"
                  ></textarea>
                </div>

                {/* Feedback Messages */}
                {error && (
                  <div className="form-error-message">
                    {error}
                  </div>
                )}
                
                {success && (
                  <div className="form-success-message">
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  className="booking-submit-button"
                  disabled={loading || !selectedServiceId || !selectedStaffId || !selectedDate || !selectedTime}
                >
                  {loading ? 'Booking Appointment...' : 'Confirm Appointment'}
                </Button>

                {/* Booking Summary */}
                {selectedService && selectedStaff && selectedDate && selectedTime && (
                  <div className="booking-summary-card">
                    <h5 className="summary-title">
                      Booking Summary
                    </h5>
                    <div className="summary-details">
                      <div className="summary-item">
                        <strong>Service:</strong> {selectedService.name}
                      </div>
                      <div className="summary-item">
                        <strong>Staff:</strong> {selectedStaff.first_name} {selectedStaff.last_name}
                      </div>
                      <div className="summary-item">
                        <strong>Date:</strong> {new Date(selectedDate).toLocaleDateString()}
                      </div>
                      <div className="summary-item">
                        <strong>Time:</strong> {selectedTime}
                      </div>
                      <div className="summary-item">
                        <strong>Total:</strong> {formatCurrency(selectedService.price)}
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookAppointment;