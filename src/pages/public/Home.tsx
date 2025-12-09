// src/pages/public/Home.tsx
import React, { useState, useEffect } from 'react';
import HeroSection from '@components/public/HeroSection';
import ServicesList from '@components/public/ServicesList';
import Button from '@components/common/Button';
import { Link } from 'react-router-dom';
import { Service } from '@models/service';
import { supabase } from '../../supabaseClient';

const Home: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch services for home page
  const fetchServices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6); // Limit to 6 for home page

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
      console.error('Error fetching services for home page:', err);
      setError('Failed to load services. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div className="elegant-home">
      <HeroSection
        title="Joyce Aesthetic Salon & Spa"
        subtitle="Experience unparalleled beauty and tranquility."
        backgroundImage="/assets/images/hero-woman.jpg"
      />
      
      <section className="page-container services-section">
        <div className="section-header">
          <h2 className="section-title animate-fade-in-up" style={{animationDelay: '0.5s'}}>Our Signature Services</h2>
          <p className="section-subtitle animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            Discover a world of relaxation and rejuvenation with our expertly crafted treatments.
            From luxurious facials to therapeutic massages, we offer an experience tailored just for you.
          </p>
        </div>
        
        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              display: 'inline-block',
              width: '40px',
              height: '40px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #2c5530',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ marginTop: '15px', color: '#666' }}>Loading services...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            backgroundColor: '#fff8f8',
            border: '1px solid #ffcdd2',
            borderRadius: '8px',
            margin: '20px 0'
          }}>
            <p style={{ color: '#c62828', margin: '0 0 10px 0' }}>{error}</p>
            <Button 
              variant="secondary" 
              onClick={fetchServices}
              size="small"
            >
              Try Again
            </Button>
          </div>
        )}
        
        {/* Services List */}
        {!loading && !error && services.length > 0 && (
          <>
            <ServicesList 
              services={services.slice(0, 3)} // Show only 3 on home page
            />
            <div className="text-center">
              <Link to="/services">
                <Button variant="secondary" size="large">View All Services</Button>
              </Link>
            </div>
          </>
        )}
        
        {/* Empty State */}
        {!loading && !error && services.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#666', marginBottom: '20px' }}>No services available at the moment.</p>
            <Link to="/services">
              <Button variant="secondary" size="medium">Check Services</Button>
            </Link>
          </div>
        )}
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
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .elegant-home {
          overflow-x: hidden;
        }
        
        .services-section {
          padding-top: 60px;
          padding-bottom: 60px;
        }
        
        .about-section {
          background-color: #f9f9f9;
          padding: 60px 0;
          margin-top: 40px;
        }
        
        .section-header {
          text-align: center;
          max-width: 800px;
          margin: 0 auto 40px;
        }
        
        .section-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: #2c5530;
          margin-bottom: 1rem;
        }
        
        .section-subtitle {
          font-size: 1.1rem;
          color: #666;
          line-height: 1.6;
        }
        
        .text-center {
          text-align: center;
          margin-top: 40px;
        }
        
        @media (max-width: 768px) {
          .section-title {
            font-size: 2rem;
          }
          
          .section-subtitle {
            font-size: 1rem;
            padding: 0 20px;
          }
          
          .services-section,
          .about-section {
            padding: 40px 0;
          }
        }
      `}</style>
    </div>
  );
};

export default Home;