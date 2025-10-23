// src/types/booking.d.ts
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  serviceId: string;
  serviceName: string;
  customerId: string;
  customerName: string;
  staffId?: string; // Optional if not assigned yet
  staffName?: string;
  startTime: string; // ISO string e.g., "2023-10-27T10:00:00Z"
  endTime: string;   // ISO string
  status: BookingStatus;
  notes?: string;
  price: number;
}

export interface NewBookingPayload {
  serviceId: string;
  startTime: string;
  endTime: string;
  notes?: string;
}