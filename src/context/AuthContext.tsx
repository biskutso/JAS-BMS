import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../supabaseClient';
import { UserRole } from '@models/user';

interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // ✅ Fetch user profile from Supabase users table (with error handling)
  const fetchUserProfile = async (userId: string): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      if (!data) {
        console.warn('No user profile found for ID:', userId);
        return null;
      }

      return {
        id: data.id,
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: (data.role as UserRole) || 'customer',
      };
    } catch (err) {
      console.error('Unexpected error fetching user profile:', err);
      return null;
    }
  };

  // ✅ Create user profile if it doesn't exist
  const createUserProfile = async (
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string = 'customer'
  ) => {
    try {
      const { error } = await supabase.from('users').insert([
        {
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          role,
        },
      ]);
      
      if (error) {
        // Handle unique constraint violation (profile might already exist)
        if (error.code === '23505') {
          console.log('User profile already exists');
          return true;
        }
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Error creating user profile:', err);
      return false;
    }
  };

  // ✅ Login
  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.user) {
      const profile = await fetchUserProfile(data.user.id);
      
      // Ensure we have a valid role, default to 'customer' if not found
      const userRole = (profile?.role as UserRole) || 'customer';
      
      const authUser = {
        id: data.user.id,
        email: data.user.email || '',
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        role: userRole,
      };
      
      setUser(authUser);
      setIsAuthenticated(true);
      localStorage.setItem('authUser', JSON.stringify(authUser));
      
      console.log('User logged in with role:', userRole); // Debug log
    }
  };
  
  // ✅ Signup
  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: string = 'customer'
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      // Create user profile
      const created = await createUserProfile(
        data.user.id,
        email,
        firstName,
        lastName,
        role
      );
      
      if (!created) {
        throw new Error('Failed to create user profile');
      }
    }
  };

  // ✅ Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('authUser');
  };

  // ✅ Restore session on reload
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const sessionUser = data.session?.user;

        if (sessionUser) {
          let profile = await fetchUserProfile(sessionUser.id);
          
          // If no profile exists, create a basic one
          if (!profile) {
            console.warn('No user profile found on session restore, creating basic profile...');
            const created = await createUserProfile(
              sessionUser.id,
              sessionUser.email || '',
              '',
              '',
              'customer'
            );
            
            if (created) {
              profile = await fetchUserProfile(sessionUser.id);
            }
          }

          const authUser = profile || {
            id: sessionUser.id,
            email: sessionUser.email || '',
            first_name: '',
            last_name: '',
            role: 'customer' as UserRole,
          };
          
          setUser(authUser);
          setIsAuthenticated(true);
          localStorage.setItem('authUser', JSON.stringify(authUser));
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    restoreSession();
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoadingAuth,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};