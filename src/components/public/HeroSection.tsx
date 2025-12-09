// src/components/public/HeroSection.tsx - Customizable Version
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  buttonText?: string;
  buttonLink?: string;
  showButton?: boolean; // Optional prop to control button visibility
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title = 'Joyce Aesthetic Salon & Spa',
  subtitle = 'Experience unparalleled beauty and tranquility.',
  backgroundImage = '/assets/images/hero-woman.jpg',
  buttonText = 'Explore Our Services',
  buttonLink = '/services',
  showButton = true,
}) => {
  const location = useLocation();
  const isServicesPage = location.pathname === '/services';
  
  // Determine if button should be shown
  const shouldShowButton = showButton && (!isServicesPage || buttonLink !== '/services');

  return (
    <section 
      className="hero-section"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <h1 className="hero-title animate-fade-in-up" style={{animationDelay: '0.2s'}}>
          {title}
        </h1>
        <p className="hero-subtitle animate-fade-in-up" style={{animationDelay: '0.4s'}}>
          {subtitle}
        </p>
        
        {/* Conditionally render button */}
        {shouldShowButton && (
          <Link to={buttonLink}>
            <p className="hero-button animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              {buttonText}
            </p>
          </Link>
        )}
      </div>
    </section>
  );
};

export default HeroSection;