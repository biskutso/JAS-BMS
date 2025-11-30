// src/pages/public/Home.tsx
import React from 'react';
import HeroSection from '@components/public/HeroSection';
import ServicesList from '@components/public/ServicesList';
import Button from '@components/common/Button';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="elegant-home">
      <HeroSection
        title="Joyce Aesthetic Salon & Spa"
        subtitle="Experience unparalleled beauty and tranquility."
        backgroundImage="/assets/images/hero-woman.jpg"
      />
      
      <section className="page-container services-section">
        <div className="section-header">
          <h2 className="section-title">Our Signature Services</h2>
          <p className="section-subtitle">
            Discover a world of relaxation and rejuvenation with our expertly crafted treatments.
            From luxurious facials to therapeutic massages, we offer an experience tailored just for you.
          </p>
        </div>
        <ServicesList limit={3} />
        <div className="text-center">
          <Link to="/services">
            <Button variant="secondary" size="large">View All Services</Button>
          </Link>
        </div>
      </section>

      <section className="about-section">
        <div className="page-container">
          <div className="section-header">
            <h2 className="section-title">About Joyce Aesthetic Salon & Spa</h2>
            <p className="section-subtitle">
              At Joyce Aesthetic, we believe in holistic well-being. Our dedicated team of professionals
              is committed to providing personalized care in a tranquil and elegant environment.
              We use only the finest products to ensure exceptional results and a truly memorable experience.
            </p>
          </div>
          <div className="text-center">
            <Link to="/contact">
              <Button variant="primary" size="medium">Contact us</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;