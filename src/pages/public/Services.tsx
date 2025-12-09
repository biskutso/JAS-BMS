// src/pages/public/Services.tsx - Clean version
import React, { useState, useEffect } from 'react';
import HeroSection from '@components/public/HeroSection';
import ServicesList from '@components/public/ServicesList';
import { Service } from '@models/service';
import { supabase } from '../../supabaseClient';
import '@assets/styles/services.css';

const Services: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Categories for filtering
  const categories = [
    { id: 'all', name: 'All Services' },
    { id: 'massage', name: 'Massage' },
    { id: 'facial', name: 'Facials' },
    { id: 'nail', name: 'Nail Care' },
    { id: 'spa', name: 'Spa Packages' },
    { id: 'hair', name: 'Hair Services' },
  ];

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
      setError('Failed to load services. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Smooth scroll to top function
  const scrollToTop = () => {
    const start = window.pageYOffset;
    const duration = 800;
    const startTime = performance.now();
    
    const animateScroll = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Cubic ease-out function
      const easeOutCubic = (t: number) => {
        return 1 - Math.pow(1 - t, 3);
      };
      
      window.scrollTo(0, start * (1 - easeOutCubic(progress)));
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  };

  // Show/hide scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter services based on selected category
  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(service => service.category === selectedCategory);

  return (
    <>
      {/* Hero Section */}
      <HeroSection
        title="Our Luxurious Services"
        subtitle="Experience relaxation and rejuvenation with our range of professional treatments."
        backgroundImage="/assets/images/hero-woman.jpg"
      />
      
      {/* Main Content */}
      <section className="services-page-container">
        <div className="services-content">
          <h2 className="services-title">Choose Your Experience</h2>
          <p className="services-subtitle">
            Whether you're seeking tranquility, beauty, or revitalization, we have something special for you.
          </p>
          
          {/* Category Tabs */}
          <div className="category-tabs-container">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`category-tab ${selectedCategory === category.id ? 'active' : ''}`}
              >
                {category.name}
              </button>
            ))}
          </div>
          
          {/* Results Count */}
          <div className="results-count">
            <p>
              Showing {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
              {selectedCategory !== 'all' && ` in ${categories.find(c => c.id === selectedCategory)?.name}`}
            </p>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading services...</p>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button 
                className="category-tab active"
                onClick={fetchServices}
                style={{ marginTop: '10px' }}
              >
                Try Again
              </button>
            </div>
          )}
          
          {/* Services List Component */}
          {!loading && !error && (
            <>
              {filteredServices.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-message">
                    No services found in this category.
                  </p>
                  <button 
                    className="category-tab active"
                    onClick={() => setSelectedCategory('all')}
                  >
                    View All Services
                  </button>
                </div>
              ) : (
                <ServicesList services={filteredServices} />
              )}
            </>
          )}
        </div>
        
        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="scroll-top-button"
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            ↑
          </button>
        )}
      </section>
    </>
  );
};

export default Services;