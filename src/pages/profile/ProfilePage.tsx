// src/pages/profile/ProfilePage.tsx
import React, { useState, useEffect, useRef } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import { useAuth } from '@context/AuthContext';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboard.css";

const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const toast = document.createElement('div');
  toast.className = `custom-toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 90px;
    right: 20px;
    padding: 12px 24px;
    background-color: ${type === 'success' ? '#38a169' : '#e53e3e'};
    color: white;
    border-radius: 8px;
    z-index: 99;
    font-family: 'Inter', sans-serif;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
};

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
  phone_num?: number; // Changed to number for int8
  profile_pic?: string; // Changed to match column name
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_num: '', // Keep as string for input, convert to number when saving
  });
  
  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  
  const [profileImage, setProfileImage] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        
        if (data) {
          setProfile(data as UserProfile);
          setFormData({
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            email: data.email || '',
            phone_num: data.phone_num?.toString() || '', // Convert number to string for input
          });
          
          // Load profile image from Profile_img bucket, profile_pic folder
          if (data.profile_pic) {
            try {
              const { data: imageData, error: imageError } = await supabase
                .storage
                .from('Profile_img')
                .createSignedUrl(`profile_pic/${data.profile_pic}`, 60 * 60);
              
              if (imageError) {
                console.error('Error creating signed URL:', imageError);
              } else if (imageData) {
                setProfileImage(imageData.signedUrl);
              }
            } catch (imageError) {
              console.error('Error loading profile image:', imageError);
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile', 'error');
      } finally {
        setLoading(false);
      }
    };
    
    loadProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    setSaving(true);
    
    try {
      // Prepare update data with correct column names
      const updateData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        created_at: new Date().toISOString(),
      };
      
      // Handle phone_num conversion from string to number (int8)
      if (formData.phone_num.trim()) {
        const phoneNum = parseInt(formData.phone_num.trim());
        if (!isNaN(phoneNum)) {
          updateData.phone_num = phoneNum;
        } else {
          updateData.phone_num = null;
        }
      } else {
        updateData.phone_num = null;
      }
      
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);
      
      if (error) throw error;
      
      if (profile) {
        setProfile({
          ...profile,
          ...updateData,
        });
      }
      
      showToast('Profile updated successfully!', 'success');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // For phone number, only allow numbers
    if (name === 'phone_num') {
      const numericValue = value.replace(/[^0-9]/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (passwordErrors[name]) {
      setPasswordErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validatePasswordForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!passwordForm.newPassword.trim()) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }

    if (!passwordForm.confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePasswordForm()) {
      showToast('Please fix the password errors', 'error');
      return;
    }

    setChangingPassword(true);
    
    try {
      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (updateError) {
        // If there's an auth session issue, try to update via admin API
        if (updateError.message.includes('Auth session missing')) {
          showToast('Please log out and log back in to change password', 'error');
          return;
        }
        throw updateError;
      }

      // Clear password form
      setPasswordForm({
        newPassword: '',
        confirmPassword: '',
      });
      
      setPasswordErrors({});
      
      showToast('Password changed successfully!', 'success');
    } catch (error: any) {
      console.error('Error changing password:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a valid image (JPEG, PNG, GIF, WebP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size should be less than 5MB', 'error');
      return;
    }

    setUploading(true);

    try {
      const fileName = `${user.id}-${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
      const filePath = `profile_pic/${fileName}`;
      
      console.log('Uploading to:', filePath);
      
      // Check if bucket exists and has RLS policies
      const { data: buckets } = await supabase.storage.listBuckets();
      console.log('Available buckets:', buckets);
      
      // Upload to Profile_img bucket, profile_pic folder
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('Profile_img')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        
        // If RLS error, try to create the bucket first or use public folder
        if (uploadError.message.includes('row-level security policy')) {
          showToast('Storage permissions issue. Please check bucket RLS policies.', 'error');
          return;
        }
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Update user profile with image path (only filename)
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_pic: fileName, // Store only filename
          created_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Get signed URL for display
      const { data: signedUrlData } = await supabase
        .storage
        .from('Profile_img')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedUrlData) {
        setProfileImage(signedUrlData.signedUrl);
        if (profile) {
          setProfile({
            ...profile,
            profile_pic: fileName
          });
        }
        showToast('Profile picture updated!', 'success');
      }

    } catch (error: any) {
      console.error('Error uploading image:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!user?.id || !profile?.profile_pic) return;

    try {
      // Remove from Profile_img bucket, profile_pic folder
      const filePath = `profile_pic/${profile.profile_pic}`;
      const { error: storageError } = await supabase.storage
        .from('Profile_img')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage remove error:', storageError);
        // Continue even if storage removal fails
      }

      // Update user record
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          profile_pic: null,
          created_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfileImage('');
      if (profile) {
        setProfile({
          ...profile,
          profile_pic: undefined
        });
      }
      
      showToast('Profile picture removed', 'success');
    } catch (error: any) {
      console.error('Error removing image:', error);
      showToast('Failed to remove image', 'error');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="dashboard-layout-container">
        <div className="dashboard-main-content">
          <DashboardHeader title="My Profile" />
          <div className="dashboard-content-wrapper">
            <div className="profile-loading">
              <div className="loading-spinner"></div>
              <p>Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    return `${formData.first_name.charAt(0)}${formData.last_name.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="My Profile" />
        <div className="dashboard-content-wrapper profile-page-wrapper">
          <div className="profile-container">
            <div className="profile-layout">
              {/* Left Column - Profile Image & Account Info */}
              <div className="profile-left-column">
                {/* Profile Image Section */}
                <div className="profile-image-section">
                  <div className="profile-image-container">
                    {profileImage ? (
                      <div className="profile-image-wrapper">
                        <img 
                          src={profileImage} 
                          alt="Profile" 
                          className="profile-image"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="profile-image-fallback hidden">
                          {getInitials()}
                        </div>
                      </div>
                    ) : (
                      <div className="profile-image-placeholder">
                        {getInitials()}
                      </div>
                    )}
                    
                    <div className="profile-image-actions">
                      <button 
                        className="profile-image-btn upload-btn"
                        onClick={triggerFileInput}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <span className="upload-spinner"></span>
                        ) : (
                          <>
                            <span className="upload-icon">📷</span>
                            <span>Change Photo</span>
                          </>
                        )}
                      </button>
                      
                      {profileImage && (
                        <button 
                          className="profile-image-btn remove-btn"
                          onClick={handleRemoveImage}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                  </div>
                  
                  <div className="profile-user-info">
                    <h2 className="profile-user-name">
                      {formData.first_name} {formData.last_name}
                    </h2>
                    <div className="profile-user-details">
                      <span className="profile-user-role">{profile?.role || 'User'}</span>
                      <span className="profile-user-email">{formData.email}</span>
                    </div>
                  </div>
                </div>

                {/* Account Info Card */}
                <div className="profile-info-card">
                  <h3 className="profile-card-title">Account Information</h3>
                  <div className="profile-info-content">
                    <div className="profile-info-item">
                      <span className="profile-info-label">Member Since</span>
                      <span className="profile-info-value">
                        {profile?.created_at ? 
                          new Date(profile.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }) : 
                          'N/A'
                        }
                      </span>
                    </div>
                    <div className="profile-info-item">
                      <span className="profile-info-label">User ID</span>
                      <span className="profile-info-value id-value">
                        {profile?.id?.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Forms */}
              <div className="profile-right-column">
                {/* Personal Information Form */}
                <div className="profile-form-section">
                  <h2 className="profile-form-title">Personal Information</h2>
                  
                  <form onSubmit={handleSubmit} className="profile-edit-form">
                    <div className="profile-form-grid">
                      <div className="profile-form-group">
                        <label htmlFor="first_name" className="profile-form-label">
                          First Name
                        </label>
                        <input
                          type="text"
                          id="first_name"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleChange}
                          className="profile-form-input"
                          placeholder="Enter your first name"
                          required
                        />
                      </div>
                      
                      <div className="profile-form-group">
                        <label htmlFor="last_name" className="profile-form-label">
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="last_name"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleChange}
                          className="profile-form-input"
                          placeholder="Enter your last name"
                          required
                        />
                      </div>
                      
                      <div className="profile-form-group full-width">
                        <label htmlFor="email" className="profile-form-label">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="profile-form-input"
                          placeholder="Enter your email"
                          required
                        />
                      </div>
                      
                      <div className="profile-form-group">
                        <label htmlFor="phone_num" className="profile-form-label">
                          Phone Number 
                        </label>
                        <input
                          type="tel"
                          id="phone_num"
                          name="phone_num"
                          value={formData.phone_num}
                          onChange={handleChange}
                          className="profile-form-input"
                          placeholder="Enter your phone number"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    
                    <div className="profile-form-actions">
                      <button 
                        type="submit" 
                        className="profile-save-btn"
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <span className="save-spinner"></span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
                
                {/* Change Password Form */}
                <div className="password-change-section">
                  <h2 className="password-change-title">Change Password</h2>
                  
                  <form onSubmit={handleChangePassword} className="password-change-form">
                    <div className="password-form-grid">
                      <div className="password-form-group">
                        <label htmlFor="newPassword" className="password-form-label">
                          New Password
                        </label>
                        <input
                          type="password"
                          id="newPassword"
                          name="newPassword"
                          value={passwordForm.newPassword}
                          onChange={handlePasswordChange}
                          className={`password-form-input ${passwordErrors.newPassword ? 'input-error' : ''}`}
                          placeholder="Enter new password"
                        />
                        {passwordErrors.newPassword && (
                          <p className="password-error">{passwordErrors.newPassword}</p>
                        )}
                      </div>
                      
                      <div className="password-form-group">
                        <label htmlFor="confirmPassword" className="password-form-label">
                          Confirm Password
                        </label>
                        <input
                          type="password"
                          id="confirmPassword"
                          name="confirmPassword"
                          value={passwordForm.confirmPassword}
                          onChange={handlePasswordChange}
                          className={`password-form-input ${passwordErrors.confirmPassword ? 'input-error' : ''}`}
                          placeholder="Confirm new password"
                        />
                        {passwordErrors.confirmPassword && (
                          <p className="password-error">{passwordErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="password-form-actions">
                      <button 
                        type="submit" 
                        className="password-change-btn"
                        disabled={changingPassword}
                      >
                        {changingPassword ? (
                          <>
                            <span className="change-spinner"></span>
                            Changing Password...
                          </>
                        ) : (
                          'Change Password'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;