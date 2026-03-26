// src/components/common/Navbar.tsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { NAV_LINKS, APP_NAME } from '@utils/constants';
import Button from './Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { useAuth } from '@context/AuthContext';
import { GiHamburgerMenu } from 'react-icons/gi';
import { IoCloseSharp } from 'react-icons/io5';
import { MdLogout } from 'react-icons/md';

// Import logo from assets
const Logo = '/assets/images/logo.png'; // Direct path to public folder

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ✅ Use the same modal hook style as DashboardHeader
  const { isOpen, openModal, closeModal } = useModal();

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Determine dashboard route based on user role
  const getDashboardRoute = () => {
    if (!isAuthenticated) return '/login';
    if (user?.role === 'customer') return '/customer/services';
    return `/${user?.role}/dashboard`;
  };

  const handleDashboardClick = () => {
    closeMobileMenu();
    window.location.href = getDashboardRoute();
  };

  // ✅ Open confirmation modal instead of logging out immediately
  const handleLogoutClick = () => {
    openModal();
    // Keep menu open/closed as-is; user can still see modal
  };

  // ✅ Confirm logout (same behavior as dashboard header)
  const handleConfirmLogout = () => {
    logout();
    closeModal();
    closeMobileMenu();
    navigate('/');
  };

  // Cancel logout
  const handleCancelLogout = () => {
    closeModal();
  };

  return (
    <>
      <nav className="navbar">
        <Link to="/" onClick={closeMobileMenu}>
          <img src={Logo} alt={APP_NAME} className="navbar-logo" />
        </Link>

        <ul className="nav-links">
          {NAV_LINKS.map((link) => (
            link.name !== "Dashboard" && (
              <li key={link.name} className="nav-link">
                <NavLink
                  to={link.path}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                >
                  {link.name}
                </NavLink>
              </li>
            )
          ))}

          {/* Single Dashboard link */}
          <li className="nav-link">
            <NavLink
              to={getDashboardRoute()}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={handleDashboardClick}
            >
              Dashboard
            </NavLink>
          </li>
        </ul>

        <div className="navbar-auth-links">
          {!isAuthenticated ? (
            <>
              <Button
                variant="secondary"
                size="small"
                onClick={() => { closeMobileMenu(); window.location.href = '/login';}}
              >
                Login
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={() => {closeMobileMenu(); window.location.href = '/signup';}}
              >
                Sign Up
              </Button>
            </>
          ) : (
            <>
              <span>Hello, {user?.first_name}</span>

              {/* ✅ Logout now opens confirmation modal */}
              <Button
                variant="secondary"
                size="small"
                onClick={handleLogoutClick}
              >
                Logout
              </Button>
            </>
          )}
        </div>

        <button
          className="hamburger-menu"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <IoCloseSharp /> : <GiHamburgerMenu />}
        </button>

        {/* Mobile Navigation Overlay */}
        <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              link.name !== "Dashboard" && (
                <li key={link.name} className="nav-link">
                  <NavLink
                    to={link.path}
                    onClick={closeMobileMenu}
                    className={({ isActive }) => (isActive ? 'active' : '')}
                  >
                    {link.name}
                  </NavLink>
                </li>
              )
            ))}

            <li className="nav-link">
              <NavLink
                to={getDashboardRoute()}
                onClick={handleDashboardClick}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Dashboard
              </NavLink>
            </li>
          </ul>

          <div className="navbar-auth-links">
            {!isAuthenticated ? (
              <>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => { closeMobileMenu(); window.location.href = '/login';}}
                >
                  Login
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => {closeMobileMenu(); window.location.href = '/signup';}}
                >
                  Sign Up
                </Button>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--color-primary-light)' }}>
                  Hello, {user?.first_name}
                </span>

                {/* ✅ Mobile logout uses same confirmation modal */}
                <Button
                  variant="primary"
                  size="small"
                  onClick={handleLogoutClick}
                >
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ✅ Logout Confirmation Modal - SAME IDS as DashboardHeader so same CSS applies */}
      <Modal isOpen={isOpen} onClose={handleCancelLogout} title="Confirm Logout">
        <div id="dashboard-logout-modal-content">
          <div id="dashboard-modal-icon">
            <MdLogout />
          </div>

          <h3 id="dashboard-modal-title">Ready to leave?</h3>
          <p id="dashboard-modal-message">
            Are you sure you want to logout from your account?
          </p>

          {user && (
            <div id="dashboard-current-user-info">
              <div id="dashboard-modal-avatar-container">
                {/* Fallback initials avatar (no profile image in Navbar, but matches dashboard look) */}
                <div id="dashboard-modal-avatar-fallback" style={{ display: 'flex' }}>
                  {`${user.first_name?.charAt(0) || 'U'}${user.last_name?.charAt(0) || ''}`.toUpperCase()}
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
            <Button variant="secondary" onClick={handleCancelLogout} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmLogout} style={{ flex: 1 }}>
              Logout
            </Button>
          </div>
        </div>
      </Modal>

      {/* ✅ same fallback avatar style used by DashboardHeader (so CSS stays consistent) */}
      <style>{`
        #dashboard-modal-avatar-fallback {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 1.2rem;
          border: 2px solid #b8860b;
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
};

export default Navbar;
