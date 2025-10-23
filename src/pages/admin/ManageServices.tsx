// src/pages/admin/ManageServices.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { Service } from '@models/service';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';

interface ServiceFormData {
  service_name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  service_img: string;
}

const ManageServices: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [formData, setFormData] = useState<ServiceFormData>({
    service_name: '',
    description: '',
    price: 0,
    duration: 60,
    category: 'facial',
    service_img: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch services from Supabase
  const fetchServices = async () => {
    try {
      setLoading(true);
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
        imageUrl: service.service_img
      }));

      setServices(transformedServices);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Image upload function
  const uploadImage = async (file: File): Promise<string> => {
    try {
      setUploading(true);
      
      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `service-images/${fileName}`;

      console.log('Uploading to bucket: service_img, path:', filePath);

      // Upload image to Supabase Storage - make sure bucket name matches exactly
      const { error: uploadError } = await supabase.storage
        .from('service_img') // Make sure this matches your bucket name exactly
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('service_img')
        .getPublicUrl(filePath);

      console.log('Upload successful, public URL:', publicUrl);
      return publicUrl;
    } catch (err: any) {
      console.error('Image upload failed:', err);
      throw new Error(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditClick = (service: Service) => {
    setEditingService(service);
    setFormData({
      service_name: service.name,
      description: service.description,
      price: service.price,
      duration: service.durationMinutes,
      category: service.category,
      service_img: service.imageUrl || ''
    });
    openModal();
  };

  const handleAddClick = () => {
    setEditingService(null);
    setFormData({
      service_name: '',
      description: '',
      price: 0,
      duration: 60,
      category: 'facial',
      service_img: ''
    });
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      const imageUrl = await uploadImage(file);
      setFormData(prev => ({ ...prev, service_img: imageUrl }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Add this validation function
  const validateForm = (): string | null => {
    if (!formData.service_name.trim()) return 'Service name is required';
    if (!formData.description.trim()) return 'Description is required';
    if (formData.price <= 0) return 'Price must be greater than 0';
    if (formData.duration < 15) return 'Duration must be at least 15 minutes';
    if (formData.duration % 15 !== 0) return 'Duration must be in 15-minute increments';
    return null;
  };

  // Update your handleSubmit to use validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // Validate required fields
      if (!formData.service_name.trim()) {
        throw new Error('Service name is required');
      }
      if (!formData.description.trim()) {
        throw new Error('Description is required');
      }
      if (formData.price <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (formData.duration < 15) {
        throw new Error('Duration must be at least 15 minutes');
      }

      const serviceData = {
        service_name: formData.service_name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        duration: formData.duration,
        category: formData.category,
        service_img: formData.service_img || null, // Use null instead of empty string
        created_at: editingService ? undefined : new Date().toISOString() // Add timestamp for new services
      };

      console.log('Submitting service data:', serviceData);

      if (editingService) {
        // Update existing service
        const { data, error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id)
          .select();

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        console.log('Updated Service:', data?.[0]);
      } else {
        // Create new service
        const { data, error } = await supabase
          .from('services')
          .insert([serviceData])
          .select();

        if (error) {
          console.error('Insert error:', error);
          
          // More specific error messages
          if (error.message.includes('row-level security')) {
            throw new Error('Database permissions error. Please check RLS policies.');
          } else if (error.message.includes('violates')) {
            throw new Error('Invalid data. Please check all fields are filled correctly.');
          } else {
            throw error;
          }
        }
        
        console.log('Added Service:', data?.[0]);
      }

      await fetchServices(); // Refresh the list
      closeModal();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save service. Please check all fields.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      await fetchServices(); // Refresh the list
      console.log('Deleted Service:', serviceId);
    } catch (err: any) {
      setError(err.message || 'Failed to delete service.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { header: 'Service Name', key: 'name' },
    { header: 'Category', key: 'category' },
    { header: 'Price', key: 'price', render: (item: Service) => formatCurrency(item.price) },
    { header: 'Duration', key: 'durationMinutes', render: (item: Service) => `${item.durationMinutes} min` },
    {
      header: 'Image',
      key: 'imageUrl',
      render: (item: Service) => 
        item.imageUrl ? (
          <img 
            src={item.imageUrl} 
            alt={item.name} 
            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} 
          />
        ) : (
          <span>No Image</span>
        )
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: Service) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="small" onClick={() => handleEditClick(item)}>Edit</Button>
          <Button variant="text" size="small" onClick={() => handleDelete(item.id)} style={{ color: '#d32f2f' }}>Delete</Button>
        </div>
      )
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Manage Services"
        actions={<Button variant="primary" onClick={handleAddClick}>Add New Service</Button>}
      />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Create, update, and remove services offered by the salon and spa.
        </p>
        
        {loading && !isOpen && <p style={{textAlign: 'center'}}>Loading services...</p>}
        {error && <p className="auth-error-message" style={{textAlign: 'center'}}>{error}</p>}
        
        <Table 
          data={services} 
          columns={columns} 
          caption="Salon & Spa Services"
          emptyMessage="No services found. Add your first service to get started."
        />
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingService ? "Edit Service" : "Add New Service"}>
        <form onSubmit={handleSubmit} className="contact-form" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="form-group">
            <label htmlFor="service-name">Service Name *</label>
            <input 
              type="text" 
              id="service-name" 
              name="service_name" 
              value={formData.service_name} 
              onChange={handleChange} 
              required 
              placeholder="Enter service name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="service-category">Category *</label>
            <select 
              id="service-category" 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              required
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="facial">Facial</option>
              <option value="massage">Massage</option>
              <option value="nail">Nail</option>
              <option value="hair">Hair</option>
              <option value="waxing">Waxing</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="form-row" style={{ display: 'flex', gap: '15px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="service-price">Price (₱) *</label>
              <input 
                type="number" 
                id="service-price" 
                name="price" 
                value={formData.price} 
                onChange={handleChange} 
                required 
                min="0" 
                step="0.01" 
                placeholder="0.00"
              />
            </div>
            
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="service-duration">Duration (minutes) *</label>
              <input 
                type="number" 
                id="service-duration" 
                name="duration" 
                value={formData.duration} 
                onChange={handleChange} 
                required 
                min="15" 
                step="15" 
                placeholder="60"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="service-description">Description *</label>
            <textarea 
              id="service-description" 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              required 
              rows={4}
              placeholder="Describe the service in detail..."
              style={{ width: '100%', resize: 'vertical' }}
            ></textarea>
          </div>
          
          <div className="form-group">
            <label htmlFor="service-image" style={{ display: 'block', marginBottom: '8px' }}>
              Service Image
            </label>
            <div style={{ 
              border: '2px dashed #ddd', 
              padding: '20px', 
              textAlign: 'center', 
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <input 
                type="file" 
                id="service-image" 
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <label 
                htmlFor="service-image" 
                style={{ 
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: uploading ? '#ccc' : '#007bff',
                  color: 'white',
                  borderRadius: '4px',
                  marginBottom: '10px'
                }}
              >
                {uploading ? 'Uploading...' : 'Choose File'}
              </label>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {formData.service_img ? 'File selected' : 'No file chosen'}
              </div>
            </div>
            
            {formData.service_img && (
              <div style={{ marginTop: '15px', textAlign: 'center' }}>
                <img 
                  src={formData.service_img} 
                  alt="Service preview" 
                  style={{ 
                    maxWidth: '200px', 
                    maxHeight: '150px', 
                    objectFit: 'cover', 
                    borderRadius: '8px',
                    border: '1px solid #ddd'
                  }} 
                />
                <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                  Current image preview
                </p>
              </div>
            )}
          </div>
          
          {error && (
            <div style={{ 
              backgroundColor: '#fee', 
              border: '1px solid #f5c6cb', 
              color: '#721c24', 
              padding: '12px', 
              borderRadius: '4px',
              marginBottom: '15px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '12px', 
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #eee'
          }}>
            <Button 
              variant="secondary" 
              onClick={closeModal} 
              disabled={loading || uploading}
              type="button"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading || uploading}
              style={{ minWidth: '120px' }}
            >
              {loading ? 'Saving...' : uploading ? 'Uploading...' : editingService ? 'Update Service' : 'Add Service'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ManageServices;