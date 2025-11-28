// src/services/supabaseNotificationService.ts
import { supabase } from '../supabaseClient';

export interface NotificationData {
  user_id: string;
  booking_id?: string;
  type: string;
  title: string;
  message: string;
}

export class SupabaseNotificationService {
  static async createBookingNotification(
    bookingId: string, 
    type: 'booking_confirmed' | 'booking_completed' | 'booking_cancelled'
  ): Promise<void> {
    try {
      console.log(`🔄 Creating ${type} notification for booking:`, bookingId);

      // Get booking details with customer information
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          services:service_id(service_name),
          customers:customer_id(id, first_name, last_name, email)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        console.error('❌ Error fetching booking details:', bookingError);
        throw bookingError;
      }

      if (!bookingData) {
        console.error('❌ Booking not found');
        throw new Error('Booking not found');
      }

      const customerId = bookingData.customer_id;
      const serviceName = bookingData.services?.service_name || 'Unknown Service';
      const bookingDate = bookingData.booking_date;

      // Determine notification message based on type
      const messages = {
        booking_confirmed: {
          title: 'Booking Confirmed',
          message: `Your "${serviceName}" on ${new Date(bookingDate).toLocaleDateString()} has been confirmed.`
        },
        booking_completed: {
          title: 'Service Completed', 
          message: `Your "${serviceName}" on ${new Date(bookingDate).toLocaleDateString()} has been completed. Thank you for visiting us!`
        },
        booking_cancelled: {
          title: 'Booking Cancelled',
          message: `Your "${serviceName}" on ${new Date(bookingDate).toLocaleDateString()} has been cancelled.`
        }
      };

      const { title, message } = messages[type];

      // Create notification in database
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: customerId,
          booking_id: bookingId,
          type,
          title,
          message
        });

      if (notificationError) {
        console.error('❌ Error creating notification:', notificationError);
        throw notificationError;
      }

      console.log(`✅ Notification created for user ${customerId}: ${message}`);

    } catch (error) {
      console.error('❌ Error creating booking notification:', error);
      // Don't throw the error here - we don't want to break the booking update
    }
  }

  // Method to create general notifications
  static async createGeneralNotification(notificationData: NotificationData): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (error) throw error;
      
      console.log('✅ General notification created');
    } catch (error) {
      console.error('❌ Error creating general notification:', error);
    }
  }
}