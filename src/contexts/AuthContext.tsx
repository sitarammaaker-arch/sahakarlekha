import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { getAuthSession, setAuthSession } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export type UserRole = 'admin' | 'accountant' | 'viewer' | 'auditor';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  societyId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; isEmailSent: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users as fallback when Supabase is unreachable
const demoUsers: { email: string; password: string; user: User }[] = [
  {
    email: 'admin@society.com',
    password: 'admin123',
    user: { id: '1', name: 'राजेश कुमार', email: 'admin@society.com', role: 'admin', societyId: 'SOC001' },
  },
  {
    email: 'accountant@society.com',
    password: 'acc123',
    user: { id: '2', name: 'सुनीता देवी', email: 'accountant@society.com', role: 'accountant', societyId: 'SOC001' },
  },
  {
    email: 'viewer@society.com',
    password: 'view123',
    user: { id: '3', name: 'मोहन लाल', email: 'viewer@society.com', role: 'viewer', societyId: 'SOC001' },
  },
  {
    email: 'auditor@society.com',
    password: 'audit123',
    user: { id: '4', name: 'CA रमेश शर्मा', email: 'auditor@society.com', role: 'auditor', societyId: 'SOC001' },
  },
];

function buildUser(data: { id: string; name: string; email: string; role: string; society_id: string }): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    societyId: data.society_id,
  };
}

function restoreSession(): User | null {
  const session = getAuthSession();
  if (!session) return null;

  // Check demo users first
  const found = demoUsers.find(u => u.user.email === session.email);
  if (found) return found.user;

  // Restore from stored session
  if (session.email && session.name && session.role && session.societyId) {
    return {
      id: session.email,
      name: session.name,
      email: session.email,
      role: session.role as UserRole,
      societyId: session.societyId,
    };
  }

  return null;
}

async function checkSuperAdmin(email: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('platform_admins')
      .select('email')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => restoreSession());
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    setUser(null);
    setIsSuperAdmin(false);
    setAuthSession(null);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(doLogout, SESSION_TIMEOUT_MS);
  }, [doLogout]);

  // Restore Supabase Auth session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        try {
          const { data } = await supabase
            .from('society_users')
            .select('id, name, email, role, society_id, is_active')
            .eq('email', session.user.email)
            .eq('is_active', true)
            .maybeSingle();

          if (data) {
            const u = buildUser(data);
            setUser(u);
            setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
            checkSuperAdmin(u.email).then(setIsSuperAdmin);
          }
        } catch {
          // Supabase unreachable — keep localStorage session
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        doLogout();
      }
    });
    return () => subscription.unsubscribe();
  }, [doLogout]);

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, resetTimer]);

  const login = async (email: string, password: string): Promise<boolean> => {
    // 1. Try Supabase Auth (signInWithPassword — JWT based)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (!authError && authData.user) {
        const { data: userData } = await supabase
          .from('society_users')
          .select('id, name, email, role, society_id, is_active')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();

        if (userData) {
          const u = buildUser(userData);
          setUser(u);
          setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
          checkSuperAdmin(u.email).then(setIsSuperAdmin);
          return true;
        }

        // Super admin may not be in society_users — check platform_admins
        const isSA = await checkSuperAdmin(email);
        if (isSA) {
          const u: User = {
            id: authData.user.id,
            name: authData.user.user_metadata?.name || email.split('@')[0],
            email,
            role: 'admin',
            societyId: 'PLATFORM',
          };
          setUser(u);
          setIsSuperAdmin(true);
          setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
          return true;
        }
      }
    } catch {
      // Supabase unreachable — fall through
    }

    // 2. Direct platform_admins password check (super admin login)
    try {
      const { data: adminData } = await supabase
        .from('platform_admins')
        .select('email, name, password')
        .eq('email', email)
        .eq('password', password)
        .eq('is_active', true)
        .maybeSingle();

      if (adminData) {
        const u: User = {
          id: email,
          name: adminData.name || email.split('@')[0],
          email,
          role: 'admin',
          societyId: 'PLATFORM',
        };
        setUser(u);
        setIsSuperAdmin(true);
        setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
        return true;
      }
    } catch {
      // Supabase unreachable — fall through
    }

    // 3. Fallback: old plain-text password check (transition period — for users not yet in Supabase Auth)
    try {
      const { data, error } = await supabase
        .from('society_users')
        .select('id, name, email, role, society_id, is_active')
        .eq('email', email)
        .eq('password', password)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        const u = buildUser(data);
        setUser(u);
        setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
        checkSuperAdmin(u.email).then(setIsSuperAdmin);
        return true;
      }
    } catch {
      // Supabase unreachable — fall through to demo users
    }

    // 4. Demo users (offline / local dev fallback)
    await new Promise(resolve => setTimeout(resolve, 400));
    const found = demoUsers.find(u => u.email === email && u.password === password);
    if (found) {
      setUser(found.user);
      setAuthSession({
        email: found.user.email,
        name: found.user.name,
        role: found.user.role,
        societyId: found.user.societyId,
      });
      return true;
    }

    return false;
  };

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — still clear local session
    }
    doLogout();
  }, [doLogout]);

  /**
   * Send password reset email.
   * Returns isEmailSent=true if Supabase Auth sent the email,
   * isEmailSent=false if the user isn't in Supabase Auth yet (contact admin path).
   */
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; isEmailSent: boolean }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (!error) {
        return { success: true, isEmailSent: true };
      }
    } catch {
      // Supabase unreachable
    }
    return { success: false, isEmailSent: false };
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // auditor has same access as viewer (read-only)
    const effectiveRole = user.role === 'auditor' ? 'viewer' : user.role;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(effectiveRole as UserRole) || roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isSuperAdmin, login, logout, hasPermission, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
