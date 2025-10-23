// src/pages/public/Home.tsx
import React from 'react';
import HeroSection from '@components/public/HeroSection'; // Using alias
import ServicesList from '@components/public/ServicesList'; // Using alias
import Button from '@components/common/Button'; // Using alias
import { Link } from 'react-router-dom'; // Need react-router-dom

const Home: React.FC = () => {
  return (
    <>
      <HeroSection />
      <section className="page-container">
        <h2 className="section-title">Our Signature Services</h2>
        <p className="section-subtitle">
          Discover a world of relaxation and rejuvenation with our expertly crafted treatments.
          From luxurious facials to therapeutic massages, we offer an experience tailored just for you.
        </p>
        <ServicesList limit={3} /> {/* Display limited services on home page */}
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
          <Link to="/services">
            <Button variant="secondary" size="large">View All Services</Button>
          </Link>
        </div>
      </section>
      {/* Example of another section - About Us */}
      <section className="page-container" style={{ backgroundColor: 'var(--color-primary-light)', padding: 'var(--spacing-xl)' }}>
        <h2 className="section-title">About Joyce Aesthetic Salon & Spa</h2>
        <p className="section-subtitle">
          At Joyce Aesthetic, we believe in holistic well-being. Our dedicated team of professionals
          is committed to providing personalized care in a tranquil and elegant environment.
          We use only the finest products to ensure exceptional results and a truly memorable experience.
        </p>
        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)' }}>
          <Link to="/contact">
            <Button variant="primary" size="medium">Contact Us</Button>
          </Link>
        </div>
      </section>
    </>
  );
};

export default Home;