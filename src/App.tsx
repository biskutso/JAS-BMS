// src/App.tsx
import React from 'react';
import './assets/styles/globals.css';
import './assets/styles/public.css';
import './assets/styles/components.css';
import './assets/styles/dashboard.css'; 
import { useLocation } from 'react-router-dom';

// Import common components
import Header from '@components/common/Header';
import Footer from '@components/common/Footer';

// Import AuthProvider and ThemeProvider
import { AuthProvider } from '@context/AuthContext';
import { ThemeProvider } from '@context/ThemeContext';

// Import BrowserRouter for routing
import { BrowserRouter as Router } from 'react-router-dom';
import AppRouter from '@router/AppRouter';

const AppContent: React.FC = () => {
  const location = useLocation();
  const isDashboardPage = location.pathname.startsWith('/dashboard') || 
                         location.pathname.startsWith('/admin') || 
                         location.pathname.startsWith('/customer') ||
                         location.pathname.startsWith('/staff');

  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Only show Header on non-dashboard pages */}
        {!isDashboardPage && <Header />}
        <main className="main-content">
          <AppRouter />
        </main>
        {!isDashboardPage && <Footer />}
      </AuthProvider>
    </ThemeProvider>
  );
};

const App: React.FC = () => {

// Change favicon
    const setFavicon = (url: string) => {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = url;
      document.getElementsByTagName('head')[0].appendChild(link);
    };

    // Change title
    document.title = 'Joyce Aesthetic Salon & Spa';
    
    // Set favicon
    setFavicon('/logo.png');

  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;