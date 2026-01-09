// src/components/common/Navbar.tsx
import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { NAV_LINKS, APP_NAME } from '@utils/constants';
import Button from './Button';
import { useAuth } from '@context/AuthContext';
import { GiHamburgerMenu } from 'react-icons/gi';
import { IoCloseSharp } from 'react-icons/io5';

// Import logo from assets
const Logo = '/assets/images/logo.png'; // Direct path to public folder

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  // Determine dashboard route based on user role
  const getDashboardRoute = () => {
    if (!isAuthenticated) {
      return '/login';
    }
    
    // If user is customer, route to /customer/services
    if (user?.role === 'customer') {
      return '/customer/services';
    }
    
    // For other roles, use the standard dashboard route
    return `/${user?.role}/dashboard`;
  };

  // Handle navigation to dashboard or login
  const handleDashboardClick = () => {
    navigate(getDashboardRoute());
    closeMobileMenu();
  };

  return (
    <nav className="navbar">
      <Link to="/">
        <img src={Logo} alt={APP_NAME} className="navbar-logo" />
      </Link>

      <ul className="nav-links">
        {NAV_LINKS.map((link) => (
          // Filter out Dashboard from NAV_LINKS since we handle it separately
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
          >
            Dashboard
          </NavLink>
        </li>
      </ul>

      <div className="navbar-auth-links">
        {!isAuthenticated ? (
          <>
            <Button variant="secondary" size="small" onClick={() => navigate('/login')}>Login</Button>
            <Button variant="primary" size="small" onClick={() => navigate('/signup')}>Sign Up</Button>
          </>
        ) : (
          <>
            <span className="">Hello, {user?.first_name}</span>
            <Button variant="secondary" size="small" onClick={handleLogout}>Logout</Button>
          </>
        )}
      </div>

      <button className="hamburger-menu" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle navigation">
        {isMobileMenuOpen ? <IoCloseSharp /> : <GiHamburgerMenu />}
      </button>

      {/* Mobile Navigation Overlay */}
      <div className={`mobile-nav-overlay ${isMobileMenuOpen ? 'open' : ''}`}>
        <ul className="nav-links">
          {NAV_LINKS.map((link) => (
            // Filter out Dashboard from NAV_LINKS for mobile too
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
          {/* Single Dashboard link for mobile */}
          <li className="nav-link">
            <NavLink
              to={getDashboardRoute()}
              onClick={closeMobileMenu}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Dashboard
            </NavLink>
          </li>
        </ul>
        <div className="navbar-auth-links">
          {!isAuthenticated ? (
            <>
              <Button variant="primary" size="small" onClick={() => { navigate('/login'); closeMobileMenu(); }}>Login</Button>
              <Button variant="primary" size="small" onClick={() => { navigate('/signup'); closeMobileMenu(); }}>Sign Up</Button>
            </>
          ) : (
            <>
              <span className="" style={{ color: 'var(--color-primary-light)' }}>Hello, {user?.first_name}</span>
              <Button variant="primary" size="small" onClick={handleLogout}>Logout</Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;