// src/components/public/HeroSection.tsx
import React from 'react';

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
}

const HeroSection: React.FC<HeroSectionProps> = ({
  title = 'Joyce Aesthetic Salon & Spa',
  subtitle = 'Experience unparalleled beauty and tranquility.',
  backgroundImage = '/assets/images/hero-woman.jpg',
}) => {
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
        <a href="/services" className="hero-button animate-fade-in-up" style={{animationDelay: '0.6s'}}>
          Explore Our Services
        </a>
      </div>
    </section>
  );
};

export default HeroSection;