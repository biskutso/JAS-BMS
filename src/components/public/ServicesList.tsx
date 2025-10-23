// src/components/public/ServicesList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@components/common/Button';
import { Service } from '@models/service';
import { formatCurrency } from '@utils/helpers';
import { DUMMY_IMAGES } from '@utils/constants';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';

// Props interface
interface ServicesListProps {
  limit?: number;
  services?: Service[]; // optional prop to override data
  onBookNow?: (service: Service) => void; // callback for booking
}

const ServicesList: React.FC<ServicesListProps> = ({ 
  limit, 
  services: servicesProp, 
  onBookNow 
}) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch services from Supabase
  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      // If custom services are passed in props, use them directly
      if (servicesProp && servicesProp.length > 0) {
        setServices(servicesProp);
        return;
      }

      // Fetch from Supabase
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
        imageUrl: service.service_img || DUMMY_IMAGES.SERVICE_FACIAL // fallback image
      }));

      setServices(transformedServices);
    } catch (err: any) {
      console.error('Error fetching services:', err);
      setError('Failed to load services. Please try again later.');
      // Fallback to dummy data if Supabase fails
      setServices(getDummyServices());
    } finally {
      setLoading(false);
    }
  };

  // Fallback dummy data
  const getDummyServices = (): Service[] => [
    {
      id: 's1',
      name: 'Luxury Hydration Facial',
      description: 'A deeply hydrating facial treatment designed to replenish and revitalize your skin, leaving it soft and glowing.',
      price: 120.0,
      durationMinutes: 60,
      category: 'facial',
      imageUrl: DUMMY_IMAGES.SERVICE_FACIAL,
    },
    {
      id: 's2',
      name: 'Aromatherapy Massage',
      description: 'Relax with a full-body massage using essential oils to soothe muscles and calm the mind.',
      price: 95.0,
      durationMinutes: 75,
      category: 'massage',
      imageUrl: DUMMY_IMAGES.SERVICE_MASSAGE,
    },
    {
      id: 's3',
      name: 'Deluxe Manicure & Pedicure',
      description: 'Pamper your hands and feet with our premium manicure and pedicure, including exfoliation and massage.',
      price: 75.0,
      durationMinutes: 90,
      category: 'nail',
      imageUrl: DUMMY_IMAGES.SERVICE_MANICURE,
    },
  ];

  useEffect(() => {
    fetchServices();
  }, [servicesProp]);

  const handleBookNow = (service: Service) => {
    if (onBookNow) {
      onBookNow(service);
      return;
    }

    // Prepare complete service data to pass to booking page
    const serviceData = {
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.durationMinutes,
      category: service.category,
      description: service.description,
      imageUrl: service.imageUrl
    };

    console.log('🎯 Passing service data to booking page:', serviceData);

    // Default behavior based on authentication status
    if (user) {
      // User is logged in - navigate to booking page with service data
      navigate('/customer/book', { 
        state: { 
          preselectedService: serviceData,
          message: `Service "${service.name}" has been pre-selected for you.`
        } 
      });
    } else {
      // User is not logged in - navigate to login page with service data
      navigate('/login', { 
        state: { 
          redirectTo: '/customer/book',
          preselectedService: serviceData,
          message: `Please login to book "${service.name}". The service will be pre-selected for you.`
        } 
      });
    }
  };

  const getButtonText = () => {
    return user ? 'Book Now' : 'Login to Book';
  };

  const getButtonVariant = () => {
    return user ? 'primary' : 'secondary';
  };

  if (loading) return <p className="text-center">Loading services...</p>;
  if (error) return <p className="text-center error-message">{error}</p>;
  if (services.length === 0) return <p className="text-center">No services available at the moment.</p>;

  const displayedServices = limit ? services.slice(0, limit) : services;

  return (
    <div className="services-list" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(3, minmax(300px, 1fr))', // Fixed 3 columns
      gap: '24px',
      padding: '20px 0',
      justifyItems: 'center',
      justifyContent: 'center',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {displayedServices.map((service) => (
        <div key={service.id} className="service-card" style={{
          border: '1px solid #e0e0e0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          backgroundColor: 'white',
          maxWidth: '350px', // Limit card width
          width: '100%' // Ensure it takes full width of grid cell
        }}>
          <img
            src={service.imageUrl}
            alt={service.name}
            style={{
              width: '100%',
              height: '200px',
              objectFit: 'cover',
              backgroundColor: '#f5f5f5'
            }}
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.src = DUMMY_IMAGES.SERVICE_FACIAL;
            }}
          />
          <div style={{ padding: '20px' }}>
            <h3 style={{ 
              margin: '0 0 12px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#333'
            }}>
              {service.name}
            </h3>
            <p style={{ 
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.5',
              minHeight: '60px' // Ensure consistent height for descriptions
            }}>
              {service.description}
            </p>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px'
            }}>
              <span style={{ 
                fontSize: '16px', 
                fontWeight: 'bold',
                color: '#2c5530'
              }}>
                {formatCurrency(service.price)}
              </span>
              <span style={{ 
                fontSize: '14px', 
                color: '#666'
              }}>
                {service.durationMinutes} min
              </span>
            </div>
            <Button 
              variant={getButtonVariant()} 
              onClick={() => handleBookNow(service)}
              style={{ width: '100%' }}
            >
              {getButtonText()}
            </Button>
            {!user && (
              <p style={{ 
                fontSize: '12px', 
                color: '#666', 
                textAlign: 'center',
                marginTop: '8px',
                marginBottom: '0'
              }}>
                Login required to book
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ServicesList;