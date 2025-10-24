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
    <section className="hero-section">
      <img
        src={backgroundImage}
        alt="Elegant woman at a salon or spa"
        className="hero-background-image"
      />
      <div className="hero-content">
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
        <a href="/services" className="hero-button">
          Explore Our Services
        </a>
      </div>
    </section>
  );
};

export default HeroSection;
