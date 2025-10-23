// src/pages/public/Services.tsx
import React, { useState, useEffect } from 'react';
import HeroSection from '@components/public/HeroSection';
import ServicesList from '@components/public/ServicesList';
import { Service } from '@models/service';
import { supabase } from '../../supabaseClient';

import '@assets/styles/public.css';

const Services: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch services from Supabase
  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match Service interface
      const transformedServices: Service[] = (data || []).map(service => ({
        id: service.id,
        name: service.service_name,
        description: service.description,
        price: parseFloat(service.price),
        durationMinutes: service.duration,
        category: service.category,
        imageUrl: service.service_img || '/src/assets/images/service-default.jpg' // fallback image
      }));

      setServices(transformedServices);
    } catch (err: any) {
      console.error('Error fetching services:', err);
      setError('Failed to load services. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Fallback services in case Supabase is empty or fails
  const fallbackServices: Service[] = [
    {
      id: '1',
      name: 'Relaxing Massage',
      description: 'Relieve stress and muscle tension with our soothing full-body massage therapy.',
      imageUrl: '/src/assets/images/service-massage.jpg',
      price: 1200,
      durationMinutes: 60,
      category: 'massage',
    },
    {
      id: '2',
      name: 'Rejuvenating Facial',
      description: 'Hydrate and refresh your skin with our premium facial treatments tailored for your needs.',
      imageUrl: '/src/assets/images/service-facial.jpg',
      price: 950,
      durationMinutes: 45,
      category: 'facial',
    },
    {
      id: '3',
      name: 'Luxury Manicure',
      description: 'Pamper your hands with our manicure service featuring organic oils and gentle care.',
      imageUrl: '/src/assets/images/service-manicure.jpg',
      price: 600,
      durationMinutes: 30,
      category: 'nail',
    },
  ];

  // Use real services if available, otherwise fallback
  const displayServices = services.length > 0 ? services : fallbackServices;

  return (
    <>
      {/* Hero Section */}
      <HeroSection
        title="Our Luxurious Services"
        subtitle="Experience relaxation and rejuvenation with our range of professional treatments."
        backgroundImage="/src/assets/images/hero-woman.jpg"
      />
      
      {/* Services Section */}
      <section className="page-container">
        <h2 className="section-title">Choose Your Experience</h2>
        <p className="section-subtitle">
          Whether you're seeking tranquility, beauty, or revitalization, we have something special for you.
        </p>
        
        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading services...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            backgroundColor: '#fee',
            border: '1px solid #f5c6cb',
            borderRadius: '8px',
            margin: '20px 0'
          }}>
            <p style={{ color: '#721c24', margin: 0 }}>{error}</p>
            <p style={{ color: '#666', fontSize: '14px', margin: '10px 0 0 0' }}>
              Showing sample services
            </p>
          </div>
        )}
        
        {/* Services List - Centered with max 3 per row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          width: '100%'
        }}>
          <div style={{ 
            maxWidth: '1200px', // Limit maximum width
            width: '100%'
          }}>
            <ServicesList 
              services={displayServices} 
              limit={displayServices.length} // Show all services but with 3 per row layout
            />
          </div>
        </div>
        
        {/* Empty State - only show if no services and not loading */}
        {!loading && services.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No services available at the moment. Please check back later.</p>
          </div>
        )}
      </section>
    </>
  );
};

export default Services;