// src/components/common/Header.tsx
import React from 'react';
import Navbar from './Navbar'; // Using alias

const Header: React.FC = () => {
  return (
    <header className="main-header">
      <Navbar />
    </header>
  );
};

export default Header;