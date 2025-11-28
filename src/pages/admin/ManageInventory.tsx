// src/pages/admin/ManageInventory.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { formatDate } from '@utils/helpers';
import { supabase } from '../../supabaseClient';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  low_stock_alert: number;
  created_at: string;
  updated_at: string;
}

interface StockTransaction {
  type: 'in' | 'out';
  quantity: number;
}

interface TransactionHistory {
  id: string;
  product_id: string;
  product_name: string;
  transaction_type: 'in' | 'out';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  created_at: string;
}

const ManageInventory: React.FC = () => {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const { isOpen: isStockModalOpen, openModal: openStockModal, closeModal: closeStockModal } = useModal();
  const { isOpen: isDeleteModalOpen, openModal: openDeleteModal, closeModal: closeDeleteModal } = useModal();
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory');
  
  const [formData, setFormData] = useState<Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>>({
    name: '', 
    category: '', 
    stock: 0,
    unit: 'bottle',
    low_stock_alert: 5
  });
  
  const [stockFormData, setStockFormData] = useState<StockTransaction>({
    type: 'in',
    quantity: 0
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Common salon product categories and units
  const salonCategories = [
    'Shampoo & Conditioner',
    'Hair Treatment',
    'Hair Color',
    'Styling Products',
    'Chemical Services',
    'Tools & Equipment',
    'Disposables',
    'Skincare',
    'Other'
  ];

  const productUnits = [
    'bottle', 'tube', 'jar', 'pack', 'box', 'piece', 'ounce', 'ml', 'liter'
  ];

  // Fetch inventory items from Supabase
  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('name', { ascending: true });

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

  // Fetch transaction history
  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
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
          stock: itemData.stock,
          unit: itemData.unit,
          low_stock_alert: itemData.low_stock_alert,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      // Log the initial stock as an "in" transaction
      if (itemData.stock > 0) {
        await supabase
          .from('inventory_transactions')
          .insert([{
            product_id: data[0].id,
            product_name: data[0].name,
            transaction_type: 'in',
            quantity: itemData.stock,
            previous_stock: 0,
            new_stock: itemData.stock,
            created_at: new Date().toISOString()
          }]);
      }

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
    try {
      setLoading(true);
      setError(null);

      // First, delete all transactions associated with this product
      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .delete()
        .eq('product_id', itemId);

      if (transactionError) {
        console.error('Error deleting transactions:', transactionError);
        // Continue with product deletion even if transaction deletion fails
      }

      // Then delete the product
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      await fetchInventory();
      await fetchTransactions();
      setSuccessMessage('Product deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      closeDeleteModal();
      
    } catch (err: any) {
      setError(`Failed to delete product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle stock transactions (in and out)
  const handleStockTransaction = async (productId: string, transaction: StockTransaction) => {
    try {
      setLoading(true);
      setError(null);

      // Get current product
      const { data: productData, error: fetchError } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      const currentProduct = productData as InventoryItem;
      let newStock = currentProduct.stock;

      // Calculate new stock based on transaction type
      switch (transaction.type) {
        case 'in':
          newStock += transaction.quantity;
          break;
        case 'out':
          if (currentProduct.stock < transaction.quantity) {
            throw new Error(`Insufficient stock. Available: ${currentProduct.stock} ${currentProduct.unit}, Requested: ${transaction.quantity}`);
          }
          newStock -= transaction.quantity;
          break;
      }

      // Update stock in database
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Log the transaction
      const { error: logError } = await supabase
        .from('inventory_transactions')
        .insert([{
          product_id: productId,
          product_name: currentProduct.name,
          transaction_type: transaction.type,
          quantity: transaction.quantity,
          previous_stock: currentProduct.stock,
          new_stock: newStock,
          created_at: new Date().toISOString()
        }]);

      if (logError) {
        console.error('Failed to log transaction:', logError);
      }

      await fetchInventory();
      await fetchTransactions();
      
      const actionMessages = {
        'in': 'Stock added successfully',
        'out': 'Stock used successfully'
      };

      setSuccessMessage(actionMessages[transaction.type]);
      setTimeout(() => setSuccessMessage(null), 3000);
      closeStockModal();
      
    } catch (err: any) {
      setError(`Failed to process stock transaction: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product: InventoryItem) => {
    setEditingProduct(product);
    setFormData({ 
      name: product.name,
      category: product.category,
      stock: product.stock,
      unit: product.unit,
      low_stock_alert: product.low_stock_alert
    });
    openModal();
  };

  const handleAddClick = () => {
    setEditingProduct(null);
    setFormData({ 
      name: '', 
      category: '', 
      stock: 0,
      unit: 'bottle',
      low_stock_alert: 5
    });
    openModal();
  };

  const handleStockActionClick = (product: InventoryItem, actionType: 'in' | 'out') => {
    setSelectedProduct(product);
    setStockFormData({
      type: actionType,
      quantity: actionType === 'out' ? 1 : 0
    });
    openStockModal();
  };

  const handleDeleteClick = (product: InventoryItem) => {
    setProductToDelete(product);
    openDeleteModal();
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await deleteInventoryItem(productToDelete.id);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleStockFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setStockFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name || !formData.category || formData.stock < 0) {
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
      await fetchTransactions();
      closeModal();
      
    } catch (err: any) {
      setError(`Failed to save product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (stockFormData.quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    await handleStockTransaction(selectedProduct.id, stockFormData);
  };

  const getStockActionColor = (type: 'in' | 'out') => {
    switch (type) {
      case 'in': return '#2e7d32';
      case 'out': return '#d32f2f';
      default: return '#666';
    }
  };

  const getStockActionLabel = (type: 'in' | 'out') => {
    switch (type) {
      case 'in': return 'Stock In';
      case 'out': return 'Stock Out';
      default: return type;
    }
  };

  const getTransactionTypeDisplay = (type: 'in' | 'out') => {
    switch (type) {
      case 'in': return { label: 'STOCK IN', color: '#2e7d32', bgColor: '#e8f5e8' };
      case 'out': return { label: 'STOCK OUT', color: '#d32f2f', bgColor: '#ffebee' };
      default: return { label: type, color: '#666', bgColor: '#f5f5f5' };
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock === 0) return { status: 'Out of Stock', color: '#d32f2f', bgColor: '#ffebee' };
    if (item.stock <= item.low_stock_alert) return { status: 'Low Stock', color: '#ed6c02', bgColor: '#fff3e0' };
    return { status: 'In Stock', color: '#2e7d32', bgColor: '#e8f5e8' };
  };

  // Group transactions by date for the stock tracker view
  const getStockTrackerData = () => {
    const stockInData = transactions.filter(t => t.transaction_type === 'in');
    const stockOutData = transactions.filter(t => t.transaction_type === 'out');
    
    // Get all unique dates from transactions
    const allDates = [...new Set(transactions.map(t => formatDate(t.created_at)))].sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    return allDates.map(date => {
      const dateInTransactions = stockInData.filter(t => formatDate(t.created_at) === date);
      const dateOutTransactions = stockOutData.filter(t => formatDate(t.created_at) === date);
      
      const maxRows = Math.max(dateInTransactions.length, dateOutTransactions.length);
      
      return {
        date,
        inRows: dateInTransactions,
        outRows: dateOutTransactions,
        maxRows
      };
    });
  };

  const inventoryColumns = [
    { 
      header: 'Product Name', 
      key: 'name',
      render: (item: InventoryItem) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{item.name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{item.category}</div>
        </div>
      )
    },
    { 
      header: 'Unit', 
      key: 'unit',
      render: (item: InventoryItem) => item.unit
    },
    { 
      header: 'Stock Balance', 
      key: 'stock',
      render: (item: InventoryItem) => {
        const status = getStockStatus(item);
        return (
          <div>
            <div style={{ 
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold',
              color: status.color,
              backgroundColor: status.bgColor,
              marginBottom: '4px'
            }}>
              {item.stock} {item.unit}{item.stock !== 1 ? 's' : ''}
            </div>
            {item.stock <= item.low_stock_alert && item.stock > 0 && (
              <div style={{ fontSize: '11px', color: '#ed6c02' }}>
                Low stock alert: {item.low_stock_alert}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: InventoryItem) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button 
            variant="text" 
            size="small" 
            onClick={() => handleStockActionClick(item, 'in')}
            style={{ 
              color: '#2e7d32',
              border: '1px solid #2e7d32',
              padding: '4px 8px',
              fontSize: '12px'
            }}
          >
            Stock In
          </Button>
          <Button 
            variant="text" 
            size="small" 
            onClick={() => handleStockActionClick(item, 'out')}
            disabled={item.stock === 0}
            style={{ 
              color: item.stock === 0 ? '#999' : '#d32f2f',
              border: `1px solid ${item.stock === 0 ? '#999' : '#d32f2f'}`,
              padding: '4px 8px',
              fontSize: '12px'
            }}
          >
            Stock Out
          </Button>
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
            onClick={() => handleDeleteClick(item)}
            style={{ 
              color: '#d32f2f',
              border: '1px solid #d32f2f'
            }}
          >
            Delete
          </Button>
        </div>
      )
    },
  ];

  const transactionColumns = [
    { 
      header: 'Date', 
      key: 'date',
      render: (item: TransactionHistory) => formatDate(item.created_at)
    },
    { 
      header: 'Product Name', 
      key: 'product_name',
      render: (item: TransactionHistory) => item.product_name
    },
    { 
      header: 'Type', 
      key: 'type',
      render: (item: TransactionHistory) => {
        const typeInfo = getTransactionTypeDisplay(item.transaction_type);
        return (
          <span style={{
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: typeInfo.color,
            backgroundColor: typeInfo.bgColor
          }}>
            {typeInfo.label}
          </span>
        );
      }
    },
    { 
      header: 'Quantity', 
      key: 'quantity',
      render: (item: TransactionHistory) => (
        <div style={{ 
          color: item.transaction_type === 'in' ? '#2e7d32' : '#d32f2f',
          fontWeight: 'bold'
        }}>
          {item.transaction_type === 'in' ? '+' : '-'}{item.quantity}
        </div>
      )
    },
    { 
      header: 'Previous Stock', 
      key: 'previous_stock',
      render: (item: TransactionHistory) => item.previous_stock
    },
    { 
      header: 'New Stock', 
      key: 'new_stock',
      render: (item: TransactionHistory) => item.new_stock
    },
  ];

  useEffect(() => {
    fetchInventory();
    fetchTransactions();
  }, []);

  const stockTrackerData = getStockTrackerData();

  return (
    <>
      <DashboardHeader
        title="Stock In - Out - Balance Tracker"
        actions={
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={fetchInventory} disabled={loading}>
              Refresh
            </Button>
            <Button variant="primary" onClick={handleAddClick} disabled={loading}>
              Add New Product
            </Button>
          </div>
        }
      />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Track stock movements and current balances for all salon products.
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
        
        {loading && !isOpen && !isStockModalOpen && !isDeleteModalOpen && (
          <p style={{textAlign: 'center'}}>Loading...</p>
        )}
        
        {error && (
          <div className="auth-error-message" style={{textAlign: 'left', whiteSpace: 'pre-wrap'}}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ marginBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            <button
              onClick={() => setActiveTab('inventory')}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: activeTab === 'inventory' ? '#1976d2' : 'transparent',
                color: activeTab === 'inventory' ? 'white' : '#666',
                cursor: 'pointer',
                borderBottom: activeTab === 'inventory' ? '2px solid #1976d2' : 'none'
              }}
            >
              Current Stock Balance
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              style={{
                padding: '12px 24px',
                border: 'none',
                backgroundColor: activeTab === 'transactions' ? '#1976d2' : 'transparent',
                color: activeTab === 'transactions' ? 'white' : '#666',
                cursor: 'pointer',
                borderBottom: activeTab === 'transactions' ? '2px solid #1976d2' : 'none'
              }}
            >
              Stock In/Out History
            </button>
          </div>
        </div>

        {activeTab === 'inventory' ? (
          <div>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Current Stock Balance</h3>
            <Table 
              data={products} 
              columns={inventoryColumns} 
              emptyMessage="No products found. Add your first product to get started."
            />
          </div>
        ) : (
          <div>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Stock In/Out History</h3>
            
            {/* Stock Tracker Table */}
            <div style={{ 
              backgroundColor: 'white', 
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '20px'
            }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom: '2px solid #1976d2'
              }}>
                <div style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f8f9fa', borderRight: '1px solid #e0e0e0' }}>
                  Stock In
                </div>
                <div style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f8f9fa', borderRight: '1px solid #e0e0e0' }}>
                  Stock Out
                </div>
                <div style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
                  Stock Balance
                </div>
              </div>

              {/* Header Row */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr',
                borderBottom: '1px solid #e0e0e0',
                backgroundColor: '#f5f5f5'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  borderRight: '1px solid #e0e0e0'
                }}>
                  <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0', fontSize: '14px', fontWeight: '600' }}>Date</div>
                  <div style={{ padding: '8px', fontSize: '14px', fontWeight: '600' }}>Item Name</div>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr',
                  borderRight: '1px solid #e0e0e0'
                }}>
                  <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0', fontSize: '14px', fontWeight: '600' }}>Date</div>
                  <div style={{ padding: '8px', fontSize: '14px', fontWeight: '600' }}>Item Name</div>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr'
                }}>
                  <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0', fontSize: '14px', fontWeight: '600' }}>Item Name</div>
                  <div style={{ padding: '8px', fontSize: '14px', fontWeight: '600' }}>Balance Quantity</div>
                </div>
              </div>

              {/* Data Rows */}
              {stockTrackerData.length > 0 ? stockTrackerData.map((dateGroup, index) => (
                <div key={index}>
                  {Array.from({ length: dateGroup.maxRows }).map((_, rowIndex) => (
                    <div key={rowIndex} style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr 1fr',
                      borderBottom: rowIndex === dateGroup.maxRows - 1 ? '2px solid #666' : '1px solid #e0e0e0'
                    }}>
                      {/* Stock In Column */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        borderRight: '1px solid #e0e0e0'
                      }}>
                        <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>
                          {dateGroup.inRows[rowIndex] ? formatDate(dateGroup.inRows[rowIndex].created_at) : ''}
                        </div>
                        <div style={{ padding: '8px' }}>
                          {dateGroup.inRows[rowIndex] ? (
                            <div>
                              <div>{dateGroup.inRows[rowIndex].product_name}</div>
                              <div style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 'bold' }}>
                                +{dateGroup.inRows[rowIndex].quantity}
                              </div>
                            </div>
                          ) : ''}
                        </div>
                      </div>

                      {/* Stock Out Column */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr',
                        borderRight: '1px solid #e0e0e0'
                      }}>
                        <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>
                          {dateGroup.outRows[rowIndex] ? formatDate(dateGroup.outRows[rowIndex].created_at) : ''}
                        </div>
                        <div style={{ padding: '8px' }}>
                          {dateGroup.outRows[rowIndex] ? (
                            <div>
                              <div>{dateGroup.outRows[rowIndex].product_name}</div>
                              <div style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold' }}>
                                -{dateGroup.outRows[rowIndex].quantity}
                              </div>
                            </div>
                          ) : ''}
                        </div>
                      </div>

                      {/* Stock Balance Column */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr'
                      }}>
                        <div style={{ padding: '8px', borderRight: '1px solid #e0e0e0' }}>
                          {products[rowIndex]?.name || ''}
                        </div>
                        <div style={{ padding: '8px' }}>
                          {products[rowIndex] ? (
                            <div style={{ 
                              color: products[rowIndex].stock === 0 ? '#d32f2f' : 
                                     products[rowIndex].stock <= products[rowIndex].low_stock_alert ? '#ed6c02' : '#2e7d32',
                              fontWeight: 'bold'
                            }}>
                              {products[rowIndex].stock} {products[rowIndex].unit}
                            </div>
                          ) : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  No stock transactions found. Stock movements will appear here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Product Add/Edit Modal */}
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
              placeholder="e.g., Professional Shampoo"
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select 
              id="category" 
              name="category" 
              value={formData.category} 
              onChange={handleChange} 
              required
            >
              <option value="">Select Category</option>
              {salonCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label htmlFor="unit">Unit *</label>
              <select 
                id="unit" 
                name="unit" 
                value={formData.unit} 
                onChange={handleChange} 
                required
              >
                {productUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="low_stock_alert">Low Stock Alert *</label>
              <input 
                type="number" 
                id="low_stock_alert" 
                name="low_stock_alert" 
                value={formData.low_stock_alert} 
                onChange={handleChange} 
                required 
                min="1" 
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="stock">Initial Stock Quantity *</label>
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

      {/* Stock Transaction Modal */}
      <Modal isOpen={isStockModalOpen} onClose={closeStockModal} title={`${getStockActionLabel(stockFormData.type)} - ${selectedProduct?.name || ''}`}>
        <form onSubmit={handleStockSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="quantity">Quantity *</label>
            <input 
              type="number" 
              id="quantity" 
              name="quantity" 
              value={stockFormData.quantity} 
              onChange={handleStockFormChange} 
              required 
              min="1" 
              step="1"
            />
            <small>Unit: {selectedProduct?.unit}</small>
          </div>

          {selectedProduct && (
            <div style={{ 
              backgroundColor: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '4px',
              marginBottom: '15px'
            }}>
              <p><strong>Current Stock:</strong> {selectedProduct.stock} {selectedProduct.unit}{selectedProduct.stock !== 1 ? 's' : ''}</p>
              <p><strong>After {getStockActionLabel(stockFormData.type).toLowerCase()}:</strong> {
                stockFormData.type === 'in' 
                  ? selectedProduct.stock + stockFormData.quantity
                  : selectedProduct.stock - stockFormData.quantity
              } {selectedProduct.unit}</p>
            </div>
          )}

          {error && <p className="auth-error-message">{error}</p>}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 'var(--spacing-md)', 
            marginTop: 'var(--spacing-lg)' 
          }}>
            <Button variant="secondary" onClick={closeStockModal} disabled={loading}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={loading}
              style={{ 
                backgroundColor: getStockActionColor(stockFormData.type),
                borderColor: getStockActionColor(stockFormData.type)
              }}
            >
              {loading ? 'Processing...' : `Confirm ${getStockActionLabel(stockFormData.type)}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal} title="Confirm Delete">
        <div>
          <p style={{ marginBottom: '20px', fontSize: '16px' }}>
            Are you sure you want to delete <strong>"{productToDelete?.name}"</strong>?
          </p>
          <p style={{ marginBottom: '20px', color: '#666', fontSize: '14px' }}>
            This action cannot be undone. All stock transactions for this product will also be deleted.
          </p>
          
          {error && <p className="auth-error-message">{error}</p>}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 'var(--spacing-md)', 
            marginTop: 'var(--spacing-lg)' 
          }}>
            <Button variant="secondary" onClick={closeDeleteModal} disabled={loading}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={confirmDelete} 
              disabled={loading}
              style={{ 
                backgroundColor: '#d32f2f',
                borderColor: '#d32f2f'
              }}
            >
              {loading ? 'Deleting...' : 'Delete Product'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ManageInventory;