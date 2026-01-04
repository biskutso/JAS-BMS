// src/pages/customer/ViewServices.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import ServicesList from '@components/public/ServicesList';
import { Service } from '@models/service';
import { supabase } from '../../supabaseClient';
import '../../assets/styles/customerdashboards.css';

const ViewServices: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch services from Supabase
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const transformedServices: Service[] = (data || []).map(service => ({
          id: service.id,
          name: service.service_name,
          description: service.description,
          price: parseFloat(service.price),
          durationMinutes: service.duration,
          category: service.category,
          imageUrl: service.service_img || '/src/assets/images/service-default.jpg'
        }));

        setServices(transformedServices);
      } catch (err: any) {
        console.error('Error fetching services:', err);
        setError('Failed to load services. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Browse & Book Services" />
        
        <div className="dashboard-content-wrapper">
          <div className="services-header">
            <p className="page-subtitle">
              Discover all available services and book your next appointment directly from here.
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="services-loading">
              <div className="loading-spinner"></div>
              <p>Loading services...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="dashboard-error">
              {error}
              <div className="error-actions">
                <button 
                  onClick={() => window.location.reload()}
                  className="retry-button"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Services List */}
          {!loading && !error && (
            <div className="services-container">
              {services.length > 0 ? (
                <ServicesList services={services} />
              ) : (
                <div className="empty-services-state">
                  <p className="empty-message">No services available at the moment.</p>
                  <p className="empty-subtext">Please check back later or contact support.</p>
                </div>
              )}
            </div>
          )}

          {/* Booking Info Banner */}
          {!loading && services.length > 0 && (
            <div className="booking-info-banner">
              <h3 className="banner-title">Ready to Book?</h3>
              <p className="banner-text">
                Click on any service to view details and schedule your appointment. 
                You can choose your preferred date, time, and staff member.
              </p>
              <div className="banner-features">
                <div className="feature-item">
                  <span className="feature-icon">📅</span>
                  <span className="feature-text">Flexible Scheduling</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">👨‍⚕️</span>
                  <span className="feature-text">Expert Staff</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">💰</span>
                  <span className="feature-text">Transparent Pricing</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewServices;