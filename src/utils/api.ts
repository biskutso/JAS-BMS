// src/utils/api.ts
import { API_BASE_URL } from './constants';
import { AuthResponse, Booking, NewBookingPayload, Service, User } from '@models/index'; // Assuming types are exported properly

// ✅ Fix: Use a different name instead of "body" to avoid conflict with RequestInit.body
interface ApiOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  jsonBody?: Record<string, any>; // Custom JSON payload
}

const callApi = async <T>(endpoint: string, options?: ApiOptions): Promise<T> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options?.token && { Authorization: `Bearer ${options.token}` }),
  };

  const config: RequestInit = {
    method: options?.method || 'GET',
    headers,
    // ✅ Fix: Only stringify jsonBody, not regular body
    body: options?.jsonBody ? JSON.stringify(options.jsonBody) : undefined,
    ...options, // Spread remaining valid RequestInit options
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API Error: ${response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error calling API endpoint ${endpoint}:`, error);
    throw error;
  }
};

// --- Authentication API ---
export const authApi = {
  login: (credentials: { email: string; password: string }): Promise<AuthResponse> =>
    callApi('/auth/login', { method: 'POST', jsonBody: credentials }),
  signup: (userData: Omit<User, 'id' | 'role'> & { password: string }): Promise<AuthResponse> =>
    callApi('/auth/signup', { method: 'POST', jsonBody: userData }),
  getCurrentUser: (token: string): Promise<User> =>
    callApi('/auth/me', { token }),
};

// --- Services API ---
export const servicesApi = {
  getAll: (): Promise<Service[]> => callApi('/services'),
  getById: (id: string): Promise<Service> => callApi(`/services/${id}`),
  create: (service: Omit<Service, 'id'>, token: string): Promise<Service> =>
    callApi('/admin/services', { method: 'POST', jsonBody: service, token }),
  update: (id: string, service: Partial<Service>, token: string): Promise<Service> =>
    callApi(`/admin/services/${id}`, { method: 'PUT', jsonBody: service, token }),
  delete: (id: string, token: string): Promise<void> =>
    callApi(`/admin/services/${id}`, { method: 'DELETE', token }),
};

// --- Bookings API ---
export const bookingsApi = {
  getAllCustomerBookings: (userId: string, token: string): Promise<Booking[]> =>
    callApi(`/customer/${userId}/bookings`, { token }),
  createBooking: (payload: NewBookingPayload, token: string): Promise<Booking> =>
    callApi('/bookings', { method: 'POST', jsonBody: payload, token }),
  updateBookingStatus: (id: string, status: Booking['status'], token: string): Promise<Booking> =>
    callApi(`/bookings/${id}/status`, { method: 'PATCH', jsonBody: { status }, token }),
  getAllBookings: (token: string): Promise<Booking[]> =>
    callApi('/admin/bookings', { token }),
};
