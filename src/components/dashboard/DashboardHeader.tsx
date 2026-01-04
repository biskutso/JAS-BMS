// src/components/dashboard/DashboardHeader.tsx
import React from 'react';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { useAuth } from '@context/AuthContext';
import { DUMMY_IMAGES } from '@utils/constants';
import { useNavigate } from 'react-router-dom';
import { MdLogout, MdPerson, MdNotifications } from 'react-icons/md';

interface DashboardHeaderProps {
  title: string;
  actions?: React.ReactNode;
  showNotificationBadge?: boolean;
  notificationCount?: number;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  title, 
  actions,
  showNotificationBadge = false,
  notificationCount = 0
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isOpen, openModal, closeModal } = useModal();

  const handleLogoutClick = () => {
    openModal();
  };

  const handleConfirmLogout = () => {
    logout();
    closeModal();
    navigate('/');
  };

  const handleProfileClick = () => {
    if (user?.role === 'admin') {
      navigate('/admin/profile');
    } else if (user?.role === 'staff') {
      navigate('/staff/profile');
    } else {
      navigate('/customer/profile');
    }
  };

  const handleNotificationsClick = () => {
    if (user?.role === 'customer') {
      navigate('/customer/notifications');
    }
  };

  return (
    <>
      <header id="dashboard-header">
        <div id="dashboard-header-content">
          <div id="dashboard-header-left">
            <h2 id="dashboard-header-title">{title}</h2>
            {user && (
              <div id="dashboard-user-greeting">
                <span id="dashboard-greeting-text">Welcome back,</span>
                <span id="dashboard-user-name">{user.first_name}</span>
              </div>
            )}
          </div>
          
          <div id="dashboard-header-right">
            <div id="dashboard-header-actions">
              {actions}
              
              {user && (
                <div id="dashboard-user-profile-section">
                  <button 
                    id="dashboard-profile-btn"
                    onClick={handleProfileClick}
                    title="Profile"
                    aria-label="Go to profile"
                  >
                    <MdPerson />
                  </button>
                  
                  {user.role === 'customer' && (
                    <button 
                      id="dashboard-notification-btn"
                      onClick={handleNotificationsClick}
                      title="Notifications"
                      aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount} unread)` : ''}`}
                    >
                      <MdNotifications />
                      {showNotificationBadge && notificationCount > 0 && (
                        <span id="dashboard-notification-indicator">
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                      )}
                    </button>
                  )}
                  
                  <div id="dashboard-user-avatar-container">
                    <img
                      src={DUMMY_IMAGES.CLIENT_AVATAR}
                      alt={`${user.first_name} ${user.last_name || ''}`}
                      id="dashboard-user-avatar"
                      title={`${user.first_name} ${user.last_name || ''} (${user.role})`}
                    />
                    <div id="dashboard-user-info">
                      <span id="dashboard-user-name-short">{user.first_name} {user.last_name?.charAt(0) || ''}.</span>
                      <span id="dashboard-user-role">{user.role}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Logout button with separate icon and text spans */}
              <button 
                onClick={handleLogoutClick}
                id="dashboard-logout-btn"
                title="Logout"
                aria-label="Logout"
              >
                <span className="logout-icon">
                  <MdLogout />
                </span>
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <Modal isOpen={isOpen} onClose={closeModal} title="Confirm Logout">
        <div id="dashboard-logout-modal-content">
          <div id="dashboard-modal-icon">
            <MdLogout />
          </div>
          <h3 id="dashboard-modal-title">Ready to leave?</h3>
          <p id="dashboard-modal-message">Are you sure you want to logout from your account?</p>
          
          {user && (
            <div id="dashboard-current-user-info">
              <img
                src={DUMMY_IMAGES.CLIENT_AVATAR}
                alt={user.first_name}
                id="dashboard-modal-avatar"
              />
              <div id="dashboard-modal-user-details">
                <strong>{user.first_name} {user.last_name || ''}</strong>
                <span id="dashboard-user-email">{user.email}</span>
              </div>
            </div>
          )}
          
          <div id="dashboard-modal-actions">
            <Button variant="secondary" onClick={closeModal} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmLogout} style={{ flex: 1 }}>
              Logout
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DashboardHeader;