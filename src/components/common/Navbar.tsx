import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { APP_NAME, DUMMY_IMAGES } from '@utils/constants';

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <img src={DUMMY_IMAGES.LOGO} alt={APP_NAME} className="logo" />
          <span>{APP_NAME}</span>
        </Link>

        <div className="nav-menu">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/services" className="nav-link">Services</Link>
          <Link to="/about" className="nav-link">About</Link>
          <Link to="/contact" className="nav-link">Contact</Link>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="welcome-message">Hello, {user?.first_name}</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
              <Link to={`/${user.role}/dashboard`} className="dashboard-btn">
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="login-btn">Login</Link>
              <Link to="/register" className="register-btn">Register</Link>
            </>
          )}
        </div>

        <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-menu">
          <Link to="/" className="mobile-nav-link" onClick={toggleMobileMenu}>Home</Link>
          <Link to="/services" className="mobile-nav-link" onClick={toggleMobileMenu}>Services</Link>
          <Link to="/about" className="mobile-nav-link" onClick={toggleMobileMenu}>About</Link>
          <Link to="/contact" className="mobile-nav-link" onClick={toggleMobileMenu}>Contact</Link>
          
          {user ? (
            <>
              <span className="welcome-message" style={{ color: 'var(--color-primary-light)', padding: '0.75rem 0' }}>
                Hello, {user?.first_name}
              </span>
              <Link to={`/${user.role}/dashboard`} className="mobile-nav-link" onClick={toggleMobileMenu}>
                Dashboard
              </Link>
              <button onClick={() => { handleLogout(); toggleMobileMenu(); }} className="mobile-logout-btn">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mobile-nav-link" onClick={toggleMobileMenu}>Login</Link>
              <Link to="/register" className="mobile-nav-link" onClick={toggleMobileMenu}>Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;