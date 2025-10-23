// src/components/dashboard/DashboardHeader.tsx
import React from 'react';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { useAuth } from '@context/AuthContext';
import { DUMMY_IMAGES } from '@utils/constants';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  title: string;
  // Any actions that might appear in the header, e.g., a "Create New" button
  actions?: React.ReactNode;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ title, actions }) => {
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

  return (
    <>
      <header className="dashboard-header">
        <h2>{title}</h2>
        <div className="dashboard-header-actions">
          {actions}
          {user && (
            <img
              src={DUMMY_IMAGES.CLIENT_AVATAR}
              alt={`${user.first_name} ${user.last_name}`}
              className="user-avatar"
              title={`Logged in as ${user.first_name}`}
            />
          )}
          <Button variant="secondary" size="small" onClick={handleLogoutClick}>
            Logout
          </Button>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} title="Confirm Logout">
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.1rem' }}>
            Are you sure you want to logout?
          </p>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 'var(--spacing-md)', 
            marginTop: 'var(--spacing-lg)' 
          }}>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmLogout}>
              Yes, Logout
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default DashboardHeader;