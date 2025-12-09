// src/components/public/ServicesList.tsx - Updated with CSS classes
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@components/common/Button';
import { Service } from '@models/service';
import { formatCurrency } from '@utils/helpers';
import { DUMMY_IMAGES } from '@utils/constants';
import { useAuth } from '@context/AuthContext';

// Props interface
interface ServicesListProps {
  limit?: number;
  services?: Service[]; // optional prop to override data
  onBookNow?: (service: Service) => void; // callback for booking
}

const ServicesList: React.FC<ServicesListProps> = ({ 
  limit, 
  services: servicesProp = [], 
  onBookNow 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

    if (user) {
      navigate('/customer/book', { 
        state: { 
          preselectedService: serviceData,
          message: `Service "${service.name}" has been pre-selected for you.`
        } 
      });
    } else {
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

  // Use provided services or show empty state
  const displayedServices = limit && servicesProp.length > limit 
    ? servicesProp.slice(0, limit) 
    : servicesProp;

  if (servicesProp.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-state-message">
          No services available at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="services-grid">
      {displayedServices.map((service) => (
        <div key={service.id} className="service-card">
          {/* Service Image */}
          <div className="service-image-container">
            <div className="service-image-overlay" />
            <img
              src={service.imageUrl}
              alt={service.name}
              className="service-image"
              onError={(e) => {
                e.currentTarget.src = DUMMY_IMAGES.SERVICE_FACIAL;
              }}
            />
          </div>
          
          {/* Service Info */}
          <div className="service-info">
            {/* Category Badge */}
            <div className="category-badge">
              {service.category?.charAt(0).toUpperCase() + service.category?.slice(1) || 'Service'}
            </div>
            
            {/* Service Name */}
            <h3 className="service-name">
              {service.name}
            </h3>
            
            {/* Description */}
            <p className="service-description">
              {service.description}
            </p>
            
            {/* Price & Duration */}
            <div className="price-duration-container">
              <div className="price-container">
                <span className="service-price">
                  {formatCurrency(service.price)}
                </span>
                <span className="price-unit">
                  / session
                </span>
              </div>
              <div className="duration-container">
                <span className="duration-icon">⏱️</span>
                <span className="duration-text">
                  {service.durationMinutes} min
                </span>
              </div>
            </div>
            
            {/* Book Button */}
            <div>
              <Button 
                variant={getButtonVariant()} 
                onClick={() => handleBookNow(service)}
                style={{ width: '100%', padding: '14px' }}
              >
                {getButtonText()}
              </Button>
              
              {/* Auth Hint */}
              {!user && (
                <p className="auth-hint">
                  Login required to book appointments
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ServicesList;