// src/pages/customer/ViewServices.tsx
import React from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import ServicesList from '@components/public/ServicesList';

const ViewServices: React.FC = () => {
  return (
    <>
      <DashboardHeader title="Browse & Book Services" />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Explore all available services and book your next appointment directly from here.
        </p>
        <ServicesList />
      </div>
    </>
  );
};

export default ViewServices;