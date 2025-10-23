// src/pages/admin/ManageInventory.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

const ManageInventory: React.FC = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>({
    name: '', 
    category: '', 
    price: 0, 
    stock: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch inventory items from Supabase
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory:', error);
        throw error;
      }

      setProducts(data || []);
      
    } catch (err: any) {
      console.error('Error in fetchInventory:', err);
      setError(`Failed to load inventory: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create new inventory item
  const createInventoryItem = async (itemData: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert([{
          name: itemData.name,
          category: itemData.category,
          price: itemData.price,
          stock: itemData.stock,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return data?.[0];
      
    } catch (err: any) {
      throw new Error(`Failed to create inventory item: ${err.message}`);
    }
  };

  // Update inventory item
  const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;
      
    } catch (err: any) {
      throw new Error(`Failed to update inventory item: ${err.message}`);
    }
  };

  // Delete inventory item
  const deleteInventoryItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchInventory();
      setSuccessMessage('Product deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete product.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product: InventoryItem) => {
    setEditingProduct(product);
    setFormData({ 
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock
    });
    openModal();
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setFormData({ 
      name: '', 
      category: '', 
      price: 0, 
      stock: 0
    });
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name || !formData.category || formData.price < 0 || formData.stock < 0) {
        throw new Error('Please fill in all required fields with valid values.');
      }

      if (editingProduct) {
        await updateInventoryItem(editingProduct.id, formData);
        setSuccessMessage('Product updated successfully');
      } else {
        await createInventoryItem(formData);
        setSuccessMessage('Product added successfully');
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchInventory();
      closeModal();
      
    } catch (err: any) {
      setError(`Failed to save product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId: string) => {
    await deleteInventoryItem(productId);
  };

  const columns = [
    { 
      header: 'Product Name', 
      key: 'name',
      render: (item: InventoryItem) => item.name
    },
    { 
      header: 'Category', 
      key: 'category',
      render: (item: InventoryItem) => item.category
    },
    { 
      header: 'Price', 
      key: 'price', 
      render: (item: InventoryItem) => formatCurrency(item.price) 
    },
    { 
      header: 'Stock', 
      key: 'stock',
      render: (item: InventoryItem) => item.stock
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: InventoryItem) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            variant="secondary" 
            size="small" 
            onClick={() => handleEditClick(item)}
          >
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

  useEffect(() => {
    fetchInventory();
  }, []);

  return (
    <>
      <DashboardHeader
        title="Manage Inventory"
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={fetchInventory} disabled={loading}>
              Refresh Inventory
            </Button>
            <Button variant="primary" onClick={handleAddClick} disabled={loading}>
              Add New Product
            </Button>
          </div>
        }
      />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Manage product inventory, stock levels, and pricing.
        </p>

        {successMessage && (
          <div style={{
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #c8e6c9'
          }}>
            {successMessage}
          </div>
        )}
        
        {loading && !isOpen && <p style={{textAlign: 'center'}}>Loading inventory...</p>}
        {error && (
          <div className="auth-error-message" style={{textAlign: 'left', whiteSpace: 'pre-wrap'}}>
            {error}
          </div>
        )}
        
        <Table 
          data={products} 
          columns={columns} 
          caption={`Inventory Items (${products.length})`}
          emptyMessage="No inventory items found. Add your first product to get started."
        />
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingProduct ? "Edit Product" : "Add New Product"}>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="name">Product Name *</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <input 
              type="text" 
              id="category" 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="price">Price *</label>
            <input 
              type="number" 
              id="price" 
              name="price" 
              value={formData.price} 
              onChange={handleChange} 
              required 
              min="0" 
              step="0.01" 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="stock">Stock Quantity *</label>
            <input 
              type="number" 
              id="stock" 
              name="stock" 
              value={formData.stock} 
              onChange={handleChange} 
              required 
              min="0" 
            />
          </div>

          {error && <p className="auth-error-message">{error}</p>}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 'var(--spacing-md)', 
            marginTop: 'var(--spacing-lg)' 
          }}>
            <Button variant="secondary" onClick={closeModal} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

export default ManageInventory;