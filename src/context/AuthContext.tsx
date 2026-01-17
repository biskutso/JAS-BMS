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
  isProfileReady: boolean;
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
  const [isProfileReady, setIsProfileReady] = useState(false);

  const mountedRef = useRef(true);
  const bootstrappedRef = useRef(false);
  const lastHydratedUserIdRef = useRef<string | null>(null);
  const profileInFlightRef = useRef<Promise<void> | null>(null);
  const suppressNextLoginLogRef = useRef(false);

  const readCachedAuthUser = (): AuthUser | null => {
    try {
      const raw = localStorage.getItem('authUser');
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  };

  const fetchUserProfile = async (userId: string): Promise<AuthUser | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!data) return null;

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
  };

  const createUserProfile = async (
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string = 'customer'
  ) => {
    await supabase.from('users').insert([
      { id: userId, email, first_name: firstName, last_name: lastName, role }
    ]);
  };

  const applySessionFast = (session: any) => {
    if (!mountedRef.current) return;

    const sessionUser = session?.user;

    if (!sessionUser) {
      lastHydratedUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      setIsProfileReady(false);
      localStorage.removeItem('authUser');
      return;
    }

    setIsAuthenticated(true);
    setIsProfileReady(false);

    const cached = readCachedAuthUser();

    // setUser((prev) => {
    //   if (prev?.id === sessionUser.id) return prev;
    //   if (cached?.id === sessionUser.id) return cached;

    //   const basic: AuthUser = {
    //     id: sessionUser.id,
    //     email: sessionUser.email || '',
    //     first_name: '',
    //     last_name: '',
    //     role: 'customer'
    //   };

    //   localStorage.setItem('authUser', JSON.stringify(basic));
    //   return basic;
    // });

    if (lastHydratedUserIdRef.current !== sessionUser.id) {
      lastHydratedUserIdRef.current = sessionUser.id;
      void hydrateProfile(sessionUser.id, sessionUser.email || '');
    }
  };

  const hydrateProfile = async (userId: string, email: string) => {
    if (profileInFlightRef.current) return;

    profileInFlightRef.current = (async () => {
      try {
        let profile = await fetchUserProfile(userId);

        if (!profile) {
          await createUserProfile(userId, email, '', '', 'customer');
          profile = await fetchUserProfile(userId);
        }

        if (!mountedRef.current) return;

        if (profile) {
          setUser(profile);
          localStorage.setItem('authUser', JSON.stringify(profile));
        }

        setIsProfileReady(true);
      } finally {
        profileInFlightRef.current = null;
      }
    })();
  };

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

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
      await createUserProfile(data.user.id, email, firstName, lastName, role);
    }
  };

  const logout = async () => {
    setIsLoadingAuth(true);
    try {
      await supabase.auth.signOut();
      lastHydratedUserIdRef.current = null;
      setUser(null);
      setIsAuthenticated(false);
      setIsProfileReady(false);
      localStorage.removeItem('authUser');
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const wake = async () => {
    try {
      suppressNextLoginLogRef.current = true;
      const { data } = await supabase.auth.getSession();
      applySessionFast(data.session);
      await supabase.auth.refreshSession();
    } finally {
      suppressNextLoginLogRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const bootstrap = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        applySessionFast(data.session);
      } finally {
        bootstrappedRef.current = true;
        setIsLoadingAuth(false);
      }
    };

    bootstrap();

    const onVis = () => document.visibilityState === 'visible' && wake();
    const onFocus = () => wake();

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      if (!bootstrappedRef.current) return;
      applySessionFast(session);
    });

    return () => {
      mountedRef.current = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isProfileReady,
      login,
      signup,
      logout
    }),
    [user, isAuthenticated, isLoadingAuth, isProfileReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
