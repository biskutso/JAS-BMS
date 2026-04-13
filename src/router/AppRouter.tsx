import React, { useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { UserRole } from '@models/user';
import BotpressChat from '@components/common/BotpressChat';
import TawkChat from '@components/common/TawkChat';

// Public Pages
import Home from '@pages/public/Home';
import Services from '@pages/public/Services';
import Contact from '@pages/public/Contact';
import LoginSignup from '@pages/public/LoginSignup';

// Dashboard Layout
import DashboardLayout from '@pages/dashboard/DashboardLayout';

// Profile
import ProfilePage from '@pages/profile/ProfilePage';

// Customer Pages
import CustomerDashboard from '@pages/customer/Dashboard';
import ViewServicesCustomer from '@pages/customer/ViewServices';
import BookAppointment from '@pages/customer/BookAppointment';
import CancelReschedule from '@pages/customer/CancelReschedule';
import Notifications from '@pages/customer/Notifications';

// Staff Pages
import StaffDashboard from '@pages/staff/Dashboard';
import CheckSchedule from '@pages/staff/CheckSchedule';
import UpdateStatus from '@pages/staff/UpdateStatus';

// Admin Pages
import AdminDashboard from '@pages/admin/Dashboard';
import ManageInventory from '@pages/admin/ManageInventory';
import ManageServices from '@pages/admin/ManageServices';
import ManageStaff from '@pages/admin/ManageStaff';
import ManageBookings from '@pages/admin/ManageBookings';
import ActivityLogs from '@pages/admin/ActivityLogs';
import GenerateReports from '@pages/admin/GenerateReports';

const NotFound: React.FC = () => (
  <div className="page-container text-center py-24">
    <h1 className="text-3xl font-bold mb-2">404 - Page Not Found</h1>
    <p className="mb-4">The page you are looking for does not exist.</p>
    <Link to="/" className="text-blue-600 hover:underline">
      Go to Home
    </Link>
  </div>
);

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="text-center py-24">
        <p>Loading authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !allowedRoles.includes(user.role as UserRole)) {
    switch (user.role) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'staff':
        return <Navigate to="/staff/dashboard" replace />;
      default:
        return <Navigate to="/customer/dashboard" replace />;
    }
  }

  return <Outlet />;
};

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppRouter: React.FC = () => {
  return (
    <>
      <ScrollToTop />
      <BotpressChat />
      <TawkChat />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<LoginSignup />} />
        <Route path="/signup" element={<LoginSignup />} />

        <Route element={<ProtectedRoute allowedRoles={['customer', 'admin']} />}>
          <Route path="/customer" element={<DashboardLayout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="services" element={<ViewServicesCustomer />} />
            <Route path="book" element={<BookAppointment />} />
            <Route path="manage-bookings" element={<CancelReschedule />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['staff', 'admin']} />}>
          <Route path="/staff" element={<DashboardLayout />}>
            <Route index element={<StaffDashboard />} />
            <Route path="dashboard" element={<StaffDashboard />} />
            <Route path="schedule" element={<CheckSchedule />} />
            <Route path="update-status" element={<UpdateStatus />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="inventory" element={<ManageInventory />} />
            <Route path="services" element={<ManageServices />} />
            <Route path="staff" element={<ManageStaff />} />
            <Route path="bookings" element={<ManageBookings />} />
            <Route path="logs" element={<ActivityLogs />} />
            <Route path="reports" element={<GenerateReports />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default AppRouter;