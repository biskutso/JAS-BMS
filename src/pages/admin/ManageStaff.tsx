// src/pages/admin/ManageStaff.tsx
import React, { useState, useEffect } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import Modal from '@components/common/Modal';
import { useModal } from '@hooks/useModal';
import { UserRole } from '@models/user';
import { capitalizeFirstLetter } from '@utils/helpers';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboards.css";

// Eye icons for show/hide password
const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  created_at: string;
}

const ManageStaff: React.FC = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const { isOpen, openModal, closeModal } = useModal();
  const [formData, setFormData] = useState({
    email: '', 
    firstName: '', 
    lastName: '', 
    password: '',
    role: 'staff' as UserRole
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch only staff and admin users from the users table
  const fetchStaffMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .in('role', ['staff', 'admin']) // Only fetch staff and admin users
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      if (!usersData || usersData.length === 0) {
        setStaffMembers([]);
        return;
      }

      // Convert users to staff members format
      const staffMembersData: StaffMember[] = usersData.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.first_name || 'Unknown',
        lastName: user.last_name || 'User',
        role: (user.role as UserRole) || 'staff',
        created_at: user.created_at
      }));

      setStaffMembers(staffMembersData);
      
    } catch (err: any) {
      console.error('Error in fetchStaffMembers:', err);
      setError(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create new staff member (user)
  const createStaffMember = async (staffData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }) => {
    try {
      // Store current admin session
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        throw new Error('No admin session found');
      }

      // Set flag to prevent auto-login
      sessionStorage.setItem('isCreatingStaff', 'true');

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: staffData.email,
        password: staffData.password,
        options: {
          data: {
            first_name: staffData.firstName,
            last_name: staffData.lastName,
            role: staffData.role
          }
        }
      });

      if (authError) {
        sessionStorage.removeItem('isCreatingStaff');
        throw new Error(`Authentication failed: ${authError.message}`);
      }

      if (!authData.user) {
        sessionStorage.removeItem('isCreatingStaff');
        throw new Error('No user returned from authentication');
      }

      // Step 2: Create user profile in users table
      const userData = {
        id: authData.user.id,
        email: staffData.email,
        first_name: staffData.firstName,
        last_name: staffData.lastName,
        role: staffData.role,
        created_at: new Date().toISOString()
      };

      const { error: userError } = await supabase
        .from('users')
        .insert([userData]);

      if (userError) {
        sessionStorage.removeItem('isCreatingStaff');
        
        if (userError.code === '23505') {
          throw new Error('User already exists in database');
        }
        throw new Error(`Failed to create user profile: ${userError.message}`);
      }

      // Restore admin session
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      sessionStorage.removeItem('isCreatingStaff');
      return { success: true, user: authData.user };
      
    } catch (err: any) {
      console.error('Error in createStaffMember:', err);
      sessionStorage.removeItem('isCreatingStaff');
      throw err;
    }
  };

  // Update user role and details
  const updateStaffMember = async (userId: string, updates: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
  }) => {
    try {
      const updateData: any = {};
      if (updates.email) updateData.email = updates.email;
      if (updates.firstName) updateData.first_name = updates.firstName;
      if (updates.lastName) updateData.last_name = updates.lastName;
      if (updates.role) updateData.role = updates.role;
      
      updateData.created_at = new Date().toISOString();

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId);

      if (error) throw error;

      return { success: true };
      
    } catch (err: any) {
      throw new Error(`Failed to update user: ${err.message}`);
    }
  };

  // Delete user
  const deleteStaffMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      await fetchStaffMembers();
      setSuccessMessage('User deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({ 
      email: staff.email, 
      firstName: staff.firstName, 
      lastName: staff.lastName, 
      password: '',
      role: staff.role
    });
    setShowPassword(false);
    openModal();
  };

  const handleAddClick = () => {
    setEditingStaff(null);
    setFormData({ 
      email: '', 
      firstName: '', 
      lastName: '', 
      password: '', 
      role: 'staff'
    });
    setShowPassword(false);
    openModal();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!formData.email || !formData.firstName || !formData.lastName) {
        throw new Error('All fields are required');
      }
      
      if (!editingStaff && !formData.password) {
        throw new Error('Password is required for new users');
      }

      if (editingStaff) {
        await updateStaffMember(editingStaff.id, {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role
        });
        setSuccessMessage('User updated successfully');
      } else {
        await createStaffMember({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role
        });
        setSuccessMessage('User created successfully');
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchStaffMembers();
      closeModal();
      
    } catch (err: any) {
      setError(`Failed to save user: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    await deleteStaffMember(staffId);
  };

  // UPDATED COLUMNS WITH SEARCHABLE AND SORTABLE PROPERTIES
  const columns = [
    { 
      header: 'Name', 
      key: 'name', 
      render: (item: StaffMember) => (
        <div className="customer-info-container">
          <div className="customer-name">{item.firstName} {item.lastName}</div>
          <div className="customer-email">
            ID: {item.id.substring(0, 8)}...
          </div>
        </div>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: StaffMember, b: StaffMember) => {
        // Sort by last name, then first name
        const aFullName = `${a.lastName} ${a.firstName}`.toLowerCase();
        const bFullName = `${b.lastName} ${b.firstName}`.toLowerCase();
        return aFullName.localeCompare(bFullName);
      }
    },
    { 
      header: 'Email', 
      key: 'email', 
      render: (item: StaffMember) => (
        <span className="staff-email">
          {item.email}
        </span>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: StaffMember, b: StaffMember) => 
        a.email.toLowerCase().localeCompare(b.email.toLowerCase())
    },
    { 
      header: 'Role', 
      key: 'role', 
      render: (item: StaffMember) => (
        <span className={`role-badge role-${item.role}`}>
          {capitalizeFirstLetter(item.role)}
        </span>
      ),
      searchable: true,
      sortable: true,
      // Custom sort function for role (admin first, then staff)
      sortFn: (a: StaffMember, b: StaffMember) => {
        const roleOrder: Record<string, number> = { 
          'admin': 0, 
          'staff': 1
        };
        
        const aOrder = roleOrder[a.role] ?? 999;
        const bOrder = roleOrder[b.role] ?? 999;
        return aOrder - bOrder;
      }
    },
    { 
      header: 'Created', 
      key: 'created_at', 
      render: (item: StaffMember) => (
        <span className="staff-created-date">
          {new Date(item.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </span>
      ),
      searchable: true,
      sortable: true,
      sortFn: (a: StaffMember, b: StaffMember) => {
        // Sort by date (newest first by default)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (item: StaffMember) => (
        <div className="staff-actions">
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
            className="delete-button"
          >
            Delete
          </Button>
        </div>
      ),
      searchable: false,
      sortable: false
    },
  ];

  useEffect(() => {
    fetchStaffMembers();
  }, []);

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Manage Staff" />
        
        <div className="dashboard-content-wrapper">
          <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)', marginTop: '80px'}}>
            {/* Manage all staff and admin users in the system. */}
          </p>

          {successMessage && (
            <div className="inventory-success-message">
              {successMessage}
            </div>
          )}
          
          {loading && !isOpen && (
            <div className="dashboard-loading">
              <p>Loading users...</p>
            </div>
          )}
          
          {error && (
            <div className="dashboard-error">
              {error}
              <div className="dashboard-error-actions">
                <Button 
                  variant="text" 
                  size="small" 
                  onClick={fetchStaffMembers}
                  style={{ fontSize: '14px' }}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
          
          <div className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">
                Staff & Admin Users ({staffMembers.length})
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button 
                  variant="secondary" 
                  onClick={fetchStaffMembers} 
                  disabled={loading}
                  size="small"
                >
                  Refresh
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleAddClick} 
                  disabled={loading}
                  size="small"
                >
                  Add New Staff
                </Button>
              </div>
            </div>

            {staffMembers.length > 0 ? (
              <Table 
                data={staffMembers} 
                columns={columns} 
                emptyMessage="No staff or admin users found. Add your first user to get started."
                searchPlaceholder="Search users by name, email, or role..."
                showSearch={true}
                showPagination={true}
              />
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">
                  No staff or admin users found.
                </p>
                <p className="empty-state-subtext">
                  Add your first user to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} title={editingStaff ? "Edit User" : "Add New User"}>
        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input 
              type="text" 
              id="firstName" 
              name="firstName" 
              value={formData.firstName} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input 
              type="text" 
              id="lastName" 
              name="lastName" 
              value={formData.lastName} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select 
              id="role" 
              name="role" 
              value={formData.role} 
              onChange={handleChange}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="password">
              {editingStaff ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div className="password-input-container">
              <input 
                type={showPassword ? "text" : "password"}
                id="password" 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                {...(!editingStaff && { required: true })}
                placeholder={editingStaff ? "Enter new password to update" : "Set password for user"}
                className="password-input"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="password-toggle-button"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {!editingStaff && (
            <div className="info-note">
              <p>
                <strong>Note:</strong> New users will be created with both auth account and user profile.
                They will receive an email confirmation to activate their account.
              </p>
            </div>
          )}
          
          {error && <p className="auth-error-message">{error}</p>}
          
          <div className="modal-actions">
            <Button variant="secondary" onClick={closeModal} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Saving...' : editingStaff ? 'Update User' : 'Add User'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageStaff;