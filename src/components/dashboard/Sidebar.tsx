// src/components/dashboard/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import {
  MdDashboard, MdPerson, MdCalendarToday, MdListAlt, MdStore,
  MdPeople, MdSettings, MdHistory, MdNotifications, MdReport, MdEventAvailable
} from 'react-icons/md'; // Material Design Icons for dashboards

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

const sidebarNavItems: NavItem[] = [
  // Customer Links
  { name: 'Dashboard', path: '/customer/dashboard', icon: MdDashboard, roles: ['customer'] },
  { name: 'Browse Services', path: '/customer/services', icon: MdListAlt, roles: ['customer'] },
  { name: 'Book Appointment', path: '/customer/book', icon: MdCalendarToday, roles: ['customer'] },
  { name: 'Manage Bookings', path: '/customer/manage-bookings', icon: MdHistory, roles: ['customer'] },
  { name: 'Notifications', path: '/customer/notifications', icon: MdNotifications, roles: ['customer'] },

  // Staff Links
  { name: 'Dashboard', path: '/staff/dashboard', icon: MdDashboard, roles: ['staff'] },
  { name: 'My Schedule', path: '/staff/schedule', icon: MdEventAvailable, roles: ['staff'] },
  { name: 'Update Status', path: '/staff/update-status', icon: MdSettings, roles: ['staff'] },

  // Admin Links
  { name: 'Dashboard', path: '/admin/dashboard', icon: MdDashboard, roles: ['admin'] },
  { name: 'Manage Inventory', path: '/admin/inventory', icon: MdStore, roles: ['admin'] },
  { name: 'Manage Services', path: '/admin/services', icon: MdListAlt, roles: ['admin'] },
  { name: 'Manage Staff', path: '/admin/staff', icon: MdPeople, roles: ['admin'] },
  { name: 'Manage Bookings', path: '/admin/bookings', icon: MdCalendarToday, roles: ['admin'] },
  { name: 'Generate Reports', path: '/admin/reports', icon: MdReport, roles: ['admin'] },
];

const Sidebar: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  
  // TEMPORARY: For design mode without auth
  const designMode = true;
  const userRole = user?.role || 'customer'; // Change to 'staff' or 'customer' as needed

   if (!isAuthenticated && !designMode) {
    return null;
  }

  // if (!isAuthenticated || !userRole) {
  //   return null; // Should ideally be handled by ProtectedRoute, but good for safety
  // }

  const filteredNavItems = sidebarNavItems.filter(item => item.roles.includes(userRole));

  return (
    <aside className="sidebar">
      <h3>{userRole.charAt(0).toUpperCase() + userRole.slice(1)} Dashboard</h3>
      <nav className="sidebar-nav">
        <ul>
          {filteredNavItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) => (isActive ? 'active' : '')}
                end // Use 'end' for exact matching to prevent partial matches
              >
                <item.icon />
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;