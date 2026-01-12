// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode
} from 'react';
import { supabase } from '../supabaseClient';
import { UserRole } from '@models/user';

interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  created_at?: string;
  phone_num?: number;
  profile_pic?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // ---- guards ----
  const mountedRef = useRef(true);
  const bootstrappedRef = useRef(false);

  // prevents duplicate SIGNED_IN events causing duplicate logs (dev/edge cases)
  const lastLogRef = useRef<{ type: 'login' | 'logout'; at: number } | null>(null);

  const fetchUserProfile = async (userId: string): Promise<AuthUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        email: data.email || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        role: (data.role as UserRole) || 'customer',
        created_at: data.created_at,
        phone_num: data.phone_num,
        profile_pic: data.profile_pic
      };
    } catch {
      return null;
    }
  };

  const createUserProfile = async (
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string = 'customer'
  ) => {
    const { error } = await supabase.from('users').insert([
      { id: userId, email, first_name: firstName, last_name: lastName, role }
    ]);

    if (error && (error as any).code === '23505') return true; // already exists
    return !error;
  };

  const applySession = async (session: any) => {
    if (!mountedRef.current) return;

    const sessionUser = session?.user;

    if (!sessionUser) {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('authUser');
      return;
    }

    let profile = await fetchUserProfile(sessionUser.id);

    if (!profile) {
      const created = await createUserProfile(
        sessionUser.id,
        sessionUser.email || '',
        '',
        '',
        'customer'
      );
      if (created) profile = await fetchUserProfile(sessionUser.id);
    }

    const authUser: AuthUser =
      profile || {
        id: sessionUser.id,
        email: sessionUser.email || '',
        first_name: '',
        last_name: '',
        role: 'customer'
      };

    if (!mountedRef.current) return;

    setUser(authUser);
    setIsAuthenticated(true);
    localStorage.setItem('authUser', JSON.stringify(authUser));
  };

  const shouldLog = (type: 'login' | 'logout') => {
    const now = Date.now();
    const last = lastLogRef.current;
    if (last && last.type === type && now - last.at < 2000) return false;
    lastLogRef.current = { type, at: now };
    return true;
  };

  // ✅ Login: ONLY sign-in. Logging happens in onAuthStateChange SIGNED_IN
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
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
      const created = await createUserProfile(data.user.id, email, firstName, lastName, role);
      if (!created) throw new Error('Failed to create user profile');
    }
  };

  // ✅ Logout: log BEFORE signOut using p_actor_id
  const logout = async () => {
    setIsLoadingAuth(true);
    try {
      const { data } = await supabase.auth.getSession();
      const actorId = data.session?.user?.id ?? null;

      // log logout BEFORE signOut (auth.uid() will become null after signOut)
      if (actorId && shouldLog('logout')) {
        const { error: rpcErr } = await supabase.rpc('log_auth_activity', {
          p_action: 'logout',
          p_actor_id: actorId
        });
        if (rpcErr) console.warn('Logout activity log RPC error:', rpcErr);
      }

      const { error } = await supabase.auth.signOut();
      if (error) console.error('Logout error:', error);

      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('authUser');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        await applySession(data.session);
      } catch (e) {
        console.error('Auth bootstrap error:', e);
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        bootstrappedRef.current = true;
        if (mountedRef.current) setIsLoadingAuth(false);
      }
    };

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      // ignore any events before bootstrap completes (prevents false redirects/logs)
      if (!bootstrappedRef.current) return;

      // Always keep state synced
      await applySession(session);

      // ✅ log LOGIN only on real SIGNED_IN (not on refresh bootstrap)
      if (event === 'SIGNED_IN') {
        // session exists here
        const actorId = session?.user?.id ?? null;
        if (actorId && shouldLog('login')) {
          const { error: rpcErr } = await supabase.rpc('log_auth_activity', {
            p_action: 'login',
            p_actor_id: actorId
          });
          if (rpcErr) console.warn('Login activity log RPC error:', rpcErr);
        }
      }

      // ✅ do NOT log SIGNED_OUT here (logout() already logs it)
      // This avoids duplicate logout logs from automatic/token events.
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ user, isAuthenticated, isLoadingAuth, login, signup, logout }),
    [user, isAuthenticated, isLoadingAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
