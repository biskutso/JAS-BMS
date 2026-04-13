// src/pages/public/LoginSignup.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Button from '@components/common/Button';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// await supabase.rpc("log_auth_activity", { p_action: "login" });

// await supabase.rpc("log_auth_activity", { p_action: "logout" });
// await supabase.auth.signOut();

const LoginSignup: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, user, isAuthenticated } = useAuth();

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setError(null);
    setLoading(false);
    setRedirecting(false);
    setShowPassword(false);
  };

  // Switch between login/signup based on URL
  useEffect(() => {
    if (location.pathname === '/login') setIsLogin(true);
    else if (location.pathname === '/signup') setIsLogin(false);

    // Clear all fields whenever page changes
    clearForm();

    // Force page refresh when switching routes
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Handle successful authentication and redirect
  useEffect(() => {
    if (isAuthenticated && user && redirecting) {
      const role = user.role || 'customer';
      console.log('Redirecting user with role:', role);

      switch (role) {
        case 'admin':
          navigate('/admin/dashboard');
          break;
        case 'staff':
          navigate('/staff/dashboard');
          break;
        default:
          navigate('/customer/services');
      }
      setRedirecting(false);
    }
  }, [isAuthenticated, user, redirecting, navigate]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setRedirecting(false);

    try {
      if (isLogin) {
        // --- LOGIN ---
        await login(email, password);
        setRedirecting(true);
      } else {
        // --- SIGNUP ---
        await signup(email, password, firstName, lastName, 'customer');
        alert('Signup successful! Please verify your email.');
        navigate('/login');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed.');
      setRedirecting(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFormToggle = () => {
    clearForm();
    navigate(isLogin ? '/signup' : '/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="password-input"
            />

            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          {error && <p className="auth-error-message">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            className="auth-submit-btn"
            disabled={loading || redirecting}
          >
            {loading || redirecting
              ? isLogin
                ? 'Logging In...'
                : 'Signing Up...'
              : isLogin
              ? 'Login'
              : 'Sign Up'}
          </Button>
        </form>

        <p className="auth-switch-link">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Link to={isLogin ? '/signup' : '/login'} onClick={handleFormToggle}>
            {isLogin ? 'Sign Up' : 'Login'}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginSignup;