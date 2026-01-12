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
import "../../assets/styles/dashboards.css";

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      // Transform data to match Service interface
      const transformedServices: Service[] = (data || []).map((service: any) => ({
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

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `service-images/${fileName}`;

      console.log('Uploading to bucket: service_img, path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('service_img')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

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
    setError(null);
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
    setError(null);
    openModal();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      const imageUrl = await uploadImage(file);
      setFormData(prev => ({ ...prev, service_img: imageUrl }));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const validateForm = (): string | null => {
    if (!formData.service_name.trim()) return 'Service name is required';
    if (!formData.description.trim()) return 'Description is required';
    if (formData.price <= 0) return 'Price must be greater than 0';
    if (formData.duration < 15) return 'Duration must be at least 15 minutes';
    if (formData.duration % 15 !== 0) return 'Duration must be in 15-minute increments';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      const serviceData: any = {
        service_name: formData.service_name.trim(),
        description: formData.description.trim(),
        price: formData.price,
        duration: formData.duration,
        category: formData.category,
        service_img: formData.service_img || null,
        ...(!editingService && { created_at: new Date().toISOString() })
      };

      console.log('Submitting service data:', serviceData);

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        setSuccessMessage('Service updated successfully');
      } else {
        const { error } = await supabase
          .from('services')
          .insert([serviceData]);

        if (error) {
          console.error('Insert error:', error);

          if (error.message.includes('row-level security')) {
            throw new Error('Database permissions error. Please check RLS policies.');
          } else if (error.message.includes('violates')) {
            throw new Error('Invalid data. Please check all fields are filled correctly.');
          } else {
            throw error;
          }
        }

        setSuccessMessage('Service added successfully');
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchServices();
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
    setSuccessMessage(null);

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      await fetchServices();
      setSuccessMessage('Service deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete service.');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'Service Name',
      key: 'name',
      render: (item: Service) => (
        <div className="customer-info-container">
          <div className="service-name">{item.name}</div>
          <div className="customer-email">{item.category}</div>
        </div>
      )
    },
    {
      header: 'Price',
      key: 'price',
      render: (item: Service) => (
        <span className="service-price">{formatCurrency(item.price)}</span>
      )
    },
    {
      header: 'Duration',
      key: 'durationMinutes',
      render: (item: Service) => (
        <span className="service-duration">{item.durationMinutes} min</span>
      )
    },
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
          <Button variant="secondary" size="small" onClick={() => handleEditClick(item)}>
            Edit
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => handleDelete(item.id)}
            style={{ color: '#d32f2f' }}
          >
            Delete
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Manage Services" />

        <div className="dashboard-content-wrapper">
          <p className="section-subtitle" style={{ textAlign: 'left', marginBottom: 'var(--spacing-lg)', marginTop: '80px' }}>
            {/* Create, update, and remove services offered by the salon and spa. */}
          </p>

          {successMessage && <div className="inventory-success-message">{successMessage}</div>}

          {loading && !isOpen && (
            <div className="dashboard-loading">
              <p>Loading services...</p>
            </div>
          )}

          {error && (
            <div className="dashboard-error">
              {error}
              <div className="dashboard-error-actions">
                <Button
                  variant="text"
                  size="small"
                  onClick={fetchServices}
                  style={{ fontSize: '14px' }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <div className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">Salon & Spa Services</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="secondary" onClick={fetchServices} disabled={loading} size="small">
                  Refresh
                </Button>
                <Button variant="primary" onClick={handleAddClick} disabled={loading} size="small">
                  Add New Service
                </Button>
              </div>
            </div>

            {services.length > 0 ? (
              <Table
                data={services}
                columns={columns}
                emptyMessage="No services found. Add your first service to get started."
              />
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">No services found.</p>
                <p className="empty-state-subtext">Add your first service to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={editingService ? "Edit Service" : "Add New Service"}
      >
        {/* Responsive modal form wrapper */}
        <form onSubmit={handleSubmit} className="contact-form service-modal-form">
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
              className="service-modal-select"
            >
              <option value="facial">Facial</option>
              <option value="massage">Massage</option>
              <option value="nail">Nail</option>
              <option value="hair">Hair</option>
              <option value="waxing">Waxing</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* ✅ Responsive 2-col grid that becomes 1-col on small screens */}
          <div className="form-grid-2">
            <div className="form-group">
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

            <div className="form-group">
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
              className="service-modal-textarea"
            />
          </div>

          <div className="form-group">
            <label htmlFor="service-image" className="service-modal-label">
              Service Image
            </label>

            <div className="service-upload-box">
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
                className={`service-upload-button ${uploading ? 'is-disabled' : ''}`}
              >
                {uploading ? 'Uploading...' : 'Choose File'}
              </label>

              <div className="service-upload-hint">
                {formData.service_img ? 'File selected' : 'No file chosen'}
              </div>
            </div>

            {formData.service_img && (
              <div className="service-image-preview">
                <img
                  src={formData.service_img}
                  alt="Service preview"
                  className="service-image-preview-img"
                />
                <p className="service-image-preview-text">Current image preview</p>
              </div>
            )}
          </div>

          {/* Inline error inside modal */}
          {error && (
            <div className="service-modal-inline-error">
              {error}
            </div>
          )}

          <div className="service-modal-actions">
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
    </div>
  );
};

export default ManageServices;
