// src/components/dashboard/DashboardHeader.tsx
import React, { useState, useEffect, useRef } from 'react';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
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
  const [profileImage, setProfileImage] = useState<string>('');
  const [loadingImage, setLoadingImage] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [modalImageError, setModalImageError] = useState(false);

  // Fetch profile image when user changes
  useEffect(() => {
    const fetchProfileImage = async () => {
      if (!user?.id) {
        setLoadingImage(false);
        return;
      }

      try {
        setLoadingImage(true);
        setImageError(false);
        setModalImageError(false);
        
        // Fetch user profile including profile_pic
        const { data, error } = await supabase
          .from('users')
          .select('profile_pic')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }

        // Load profile image from Profile_img bucket, profile_pic folder
        if (data?.profile_pic) {
          try {
            const { data: imageData, error: imageError } = await supabase
              .storage
              .from('Profile_img')
              .createSignedUrl(`profile_pic/${data.profile_pic}`, 60 * 60);
            
            if (imageError) {
              console.error('Error creating signed URL:', imageError);
              setImageError(true);
              setModalImageError(true);
            } else if (imageData) {
              setProfileImage(imageData.signedUrl);
            }
          } catch (imageError) {
            console.error('Error loading profile image:', imageError);
            setImageError(true);
            setModalImageError(true);
          }
        } else {
          // No profile picture exists
          setImageError(true);
          setModalImageError(true);
        }
      } catch (error) {
        console.error('Error fetching profile image:', error);
        setImageError(true);
        setModalImageError(true);
      } finally {
        setLoadingImage(false);
      }
    };

    fetchProfileImage();
  }, [user]);

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
    if (user?.role === 'admin') {
      navigate('/admin/notifications');
    } else if (user?.role === 'staff') {
      navigate('/staff/notifications');
    } else {
      navigate('/customer/notifications');
    }
  };

  // Get user initials for fallback avatar
  const getUserInitials = () => {
    if (!user?.first_name) return 'U';
    const firstInitial = user.first_name.charAt(0);
    const lastInitial = user.last_name?.charAt(0) || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  return (
    <>
      <header id="dashboard-header">
        <div id="dashboard-header-content">
          <div id="dashboard-header-left">
            <h2 id="dashboard-header-title">{title}</h2>
            {user && (
              <div id="dashboard-user-greeting">
                {/* <span id="dashboard-greeting-text">Welcome back,</span>
                <span id="dashboard-user-name">{user.first_name}</span> */}
              </div>
            )}
          </div>
          
          <div id="dashboard-header-right">
            <div id="dashboard-header-actions">
              {actions}
              
              {user && (
                <div id="dashboard-user-profile-section">
                  {/* Combined Profile Section */}
                  <div 
                    id="dashboard-profile-avatar-container"
                    onClick={handleProfileClick}
                    style={{ cursor: 'pointer' }}
                    title={`${user.first_name} ${user.last_name || ''} - ${user.role}`}
                    aria-label="Go to profile"
                  >
                    <div id="dashboard-avatar-wrapper">
                      {loadingImage ? (
                        <div className="avatar-loading"></div>
                      ) : profileImage && !imageError ? (
                        <img
                          src={profileImage}
                          alt={`${user.first_name} ${user.last_name || ''}`}
                          id="dashboard-profile-avatar"
                          onError={() => setImageError(true)}
                          onLoad={() => setImageError(false)}
                        />
                      ) : null}
                      
                      {/* Fallback avatar with initials - only show when no image or image failed to load */}
                      <div 
                        id="dashboard-avatar-fallback" 
                        style={{
                          display: loadingImage || (profileImage && !imageError) ? 'none' : 'flex'
                        }}
                      >
                        {getUserInitials()}
                      </div>
                    </div>
                    
                    <div id="dashboard-user-info">
                      <span id="dashboard-user-name-short">{user.first_name} {user.last_name?.charAt(0) || ''}.</span>
                      <span id="dashboard-user-role">{user.role}</span>
                    </div>
                  </div>
                  
                  {/* Notifications button for customers */}
                  {['customer', 'staff', 'admin'].includes(user.role) && (
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
                </div>
              )}
              
              {/* Logout button */}
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
              <div id="dashboard-modal-avatar-container">
                {profileImage && !modalImageError ? (
                  <img
                    src={profileImage}
                    alt={user.first_name}
                    id="dashboard-modal-avatar"
                    onError={() => setModalImageError(true)}
                    onLoad={() => setModalImageError(false)}
                  />
                ) : null}
                <div 
                  id="dashboard-modal-avatar-fallback" 
                  style={{
                    display: profileImage && !modalImageError ? 'none' : 'flex'
                  }}
                >
                  {getUserInitials()}
                </div>
              </div>
              <div id="dashboard-modal-user-details">
                <strong>{user.first_name} {user.last_name || ''}</strong>
                <span id="dashboard-user-email">{user.email}</span>
                <span id="dashboard-user-role-modal">{user.role}</span>
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

      <style>{`
        /* Avatar Loading Animation */
        .avatar-loading {
          width: 36px;
          height: 36px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #b8860b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Fallback avatar styles */
        #dashboard-avatar-fallback,
        #dashboard-modal-avatar-fallback {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 0.9rem;
          border: 2px solid #b8860b;
          flex-shrink: 0;
        }

        /* Modal avatar fallback */
        #dashboard-modal-avatar-fallback {
          width: 50px;
          height: 50px;
          font-size: 1.2rem;
        }
      `}</style>
    </>
  );
};

export default DashboardHeader;