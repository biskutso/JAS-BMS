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

  return (
    <nav className="navbar">
      <Link to="/">
        <img src={Logo} alt={APP_NAME} className="navbar-logo" />
      </Link>

      <ul className="nav-links">
        {NAV_LINKS.map((link) => (
          (link.name !== "Login" || !isAuthenticated) && (
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
        {isAuthenticated && (
          <li className="nav-link">
            <NavLink
              to={`/${user?.role}/dashboard`}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              Dashboard
            </NavLink>
          </li>
        )}
      </ul>

      <div className="navbar-auth-links">
        {!isAuthenticated ? (
          <>
            <Button variant="secondary" size="small" onClick={() => navigate('/login')}>Login</Button>
            <Button variant="primary" size="small" onClick={() => navigate('/signup')}>Sign Up</Button>
          </>
        ) : (
          <>
            <span className="welcome-message">Hello, {user?.first_name}</span>
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
            (link.name !== "Login" || !isAuthenticated) && (
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
          {isAuthenticated && (
            <li className="nav-link">
              <NavLink
                to={`/${user?.role}/dashboard`}
                onClick={closeMobileMenu}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                Dashboard
              </NavLink>
            </li>
          )}
        </ul>
        <div className="navbar-auth-links">
          {!isAuthenticated ? (
            <>
              <Button variant="secondary" size="small" onClick={() => { navigate('/login'); closeMobileMenu(); }}>Login</Button>
              <Button variant="primary" size="small" onClick={() => { navigate('/signup'); closeMobileMenu(); }}>Sign Up</Button>
            </>
          ) : (
            <>
              <span className="welcome-message" style={{ color: 'var(--color-primary-light)' }}>Hello, {user?.first_name}</span>
              <Button variant="secondary" size="small" onClick={handleLogout}>Logout</Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;