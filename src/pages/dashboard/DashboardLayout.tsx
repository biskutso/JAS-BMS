// src/pages/dashboard/DashboardLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@components/dashboard/Sidebar'; // Using alias
// Note: DashboardHeader title and actions are passed from the specific dashboard page.

const DashboardLayout: React.FC = () => {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content-area">
        {/*
          The DashboardHeader and the actual page content (Outlet)
          will be rendered here.
          The specific dashboard page will pass its title to DashboardHeader.
        */}
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;