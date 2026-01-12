// src/App.tsx
import React, { useEffect } from 'react';
import './assets/styles/globals.css';
import './assets/styles/public.css';
import './assets/styles/components.css';
import './assets/styles/dashboard.css';

import { BrowserRouter as Router, useLocation } from 'react-router-dom';

import Header from '@components/common/Header';
import Footer from '@components/common/Footer';

import { AuthProvider } from '@context/AuthContext';
import { ThemeProvider } from '@context/ThemeContext';

import AppRouter from '@router/AppRouter';

const Shell: React.FC = () => {
  const location = useLocation();

  const isDashboardPage =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/customer') ||
    location.pathname.startsWith('/staff');

  return (
    <>
      {!isDashboardPage && <Header />}
      <main className="main-content">
        <AppRouter />
      </main>
      {!isDashboardPage && <Footer />}
    </>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Change title
    document.title = 'Joyce Aesthetic Salon & Spa';

    // Change favicon
    const setFavicon = (url: string) => {
      const existing = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      const link = existing || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = url;
      if (!existing) document.head.appendChild(link);
    };

    setFavicon('/logo.png');
  }, []);

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;
