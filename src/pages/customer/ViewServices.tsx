// src/pages/customer/ViewServices.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import ServicesList from '@components/public/ServicesList';
import { Service } from '@models/service';
import { supabase } from '../../supabaseClient';
import Button from '@components/common/Button';
import '../../assets/styles/customerdashboards.css';

// Define category types (you might want to move this to constants)
const ALL_CATEGORIES = 'All Categories';

const ViewServices: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([ALL_CATEGORIES]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch services from Supabase
  useEffect(() => {
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
        setFilteredServices(transformedServices);
        
        // Extract unique categories
        const uniqueCategories = [...new Set(transformedServices.map(s => s.category))];
        setCategories([ALL_CATEGORIES, ...uniqueCategories]);
        
      } catch (err: any) {
        console.error('Error fetching services:', err);
        setError('Failed to load services. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  // Function to filter services by category
  const filterServicesByCategory = (category: string) => {
    setSelectedCategory(category);
    
    if (category === ALL_CATEGORIES) {
      setFilteredServices(services);
    } else {
      const filtered = services.filter(service => 
        service.category.toLowerCase() === category.toLowerCase()
      );
      setFilteredServices(filtered);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCategory(ALL_CATEGORIES);
    setFilteredServices(services);
  };

  // Function to search services by name
  const searchServices = (searchTerm: string) => {
    if (!searchTerm.trim()) {
      // If search is empty, apply category filter only
      filterServicesByCategory(selectedCategory);
      return;
    }
    
    const lowercasedTerm = searchTerm.toLowerCase();
    let results = services;
    
    // Apply category filter first if not "All Categories"
    if (selectedCategory !== ALL_CATEGORIES) {
      results = services.filter(service => 
        service.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    // Then apply search filter
    const searched = results.filter(service => 
      service.name.toLowerCase().includes(lowercasedTerm) ||
      service.description.toLowerCase().includes(lowercasedTerm)
    );
    
    setFilteredServices(searched);
  };

  // Function to sort services (you can expand this)
  const sortServices = (sortBy: 'name' | 'price-low' | 'price-high' | 'duration') => {
    let sorted = [...filteredServices];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'duration':
        sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
        break;
      default:
        // Default to original order
        sorted = services;
        if (selectedCategory !== ALL_CATEGORIES) {
          sorted = services.filter(service => 
            service.category.toLowerCase() === selectedCategory.toLowerCase()
          );
        }
    }
    
    setFilteredServices(sorted);
  };

  // Get unique services count by category
  const getServiceCountByCategory = (category: string) => {
    if (category === ALL_CATEGORIES) {
      return services.length;
    }
    return services.filter(service => 
      service.category.toLowerCase() === category.toLowerCase()
    ).length;
  };

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Browse & Book Services" />
        
        <div className="dashboard-content-wrapper">
          {/* <div className="services-header">
            <h1 className="page-title">Available Services</h1>
            <p className="page-subtitle">
              Discover all available services and book your next appointment directly from here.
            </p>
          </div> */}

          {/* Filters Section */}
          <div className="services-filters-section">
            <div className="filters-header">
              <h3 className="filters-title">Filter Services</h3>
              {selectedCategory !== ALL_CATEGORIES && (
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={clearFilters}
                  className="clear-filters-button"
                >
                  Clear Filters
                </Button>
              )}
            </div>
            
            {/* Category Filter */}
            <div className="filter-group">
              <h4 className="filter-group-title">By Category</h4>
              <div className="category-filter-buttons">
                {categories.map(category => (
                  <button
                    key={category}
                    className={`category-filter-button ${
                      selectedCategory === category ? 'active' : ''
                    }`}
                    onClick={() => filterServicesByCategory(category)}
                  >
                    <span className="category-name">{category}</span>
                    <span className="category-count">
                      ({getServiceCountByCategory(category)})
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Sort Section */}
            <div className="search-sort-section">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search services by name or description..."
                  onChange={(e) => searchServices(e.target.value)}
                  className="search-input"
                />
                <span className="search-icon">🔍</span>
              </div>
              
              <div className="sort-dropdown">
                <label htmlFor="sort-select" className="sort-label">Sort by:</label>
                <select
                  id="sort-select"
                  onChange={(e) => sortServices(e.target.value as any)}
                  className="sort-select"
                  defaultValue=""
                >
                  <option value="" disabled>Select sort option</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="price-low">Price (Low to High)</option>
                  <option value="price-high">Price (High to Low)</option>
                  <option value="duration">Duration (Short to Long)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="results-summary">
            <p className="results-count">
              Showing {filteredServices.length} of {services.length} service{services.length !== 1 ? 's' : ''}
              {selectedCategory !== ALL_CATEGORIES && ` in "${selectedCategory}"`}
            </p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="services-loading">
              <div className="loading-spinner"></div>
              <p>Loading services...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="dashboard-error">
              {error}
              <div className="error-actions">
                <button 
                  onClick={() => window.location.reload()}
                  className="retry-button"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Services List */}
          {!loading && !error && (
            <div className="services-container">
              {filteredServices.length > 0 ? (
                <ServicesList services={filteredServices} />
              ) : (
                <div className="empty-services-state">
                  <p className="empty-message">
                    {services.length > 0 
                      ? 'No services match your current filters.' 
                      : 'No services available at the moment.'
                    }
                  </p>
                  <p className="empty-subtext">
                    {services.length > 0 
                      ? 'Try changing your search or filter criteria.'
                      : 'Please check back later or contact support.'
                    }
                  </p>
                  {services.length > 0 && (
                    <Button 
                      variant="primary" 
                      size="medium" 
                      onClick={clearFilters}
                      className="reset-filters-button"
                    >
                      Reset All Filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Booking Info Banner */}
          {!loading && filteredServices.length > 0 && (
            <div className="booking-info-banner">
              <h3 className="banner-title">Ready to Book?</h3>
              <p className="banner-text">
                Click on any service to view details and schedule your appointment. 
                You can choose your preferred date, time, and staff member.
              </p>
              <div className="banner-features">
                <div className="feature-item">
                  <span className="feature-icon">📅</span>
                  <span className="feature-text">Flexible Scheduling</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">👨‍⚕️</span>
                  <span className="feature-text">Expert Staff</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">💰</span>
                  <span className="feature-text">Transparent Pricing</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewServices;