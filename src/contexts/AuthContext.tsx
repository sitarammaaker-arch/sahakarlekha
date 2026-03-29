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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users as fallback
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

function restoreSession(): User | null {
  const session = getAuthSession();
  if (!session) return null;

  // Check demo users first
  const found = demoUsers.find(u => u.user.email === session.email);
  if (found) return found.user;

  // Restore from stored session (Supabase user)
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => restoreSession());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    setUser(null);
    setAuthSession(null);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(doLogout, SESSION_TIMEOUT_MS);
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
    // 1. Try Supabase society_users first
    try {
      const { data, error } = await supabase
        .from('society_users')
        .select('id, name, email, role, society_id, is_active')
        .eq('email', email)
        .eq('password', password)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        const u: User = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role as UserRole,
          societyId: data.society_id,
        };
        setUser(u);
        setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId });
        return true;
      }
    } catch {
      // Supabase unreachable — fall through to demo users
    }

    // 2. Fallback: demo users
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

  const logout = doLogout;

  const hasPermission = (requiredRole: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    // auditor has same access as viewer (read-only)
    const effectiveRole = user.role === 'auditor' ? 'viewer' : user.role;
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(effectiveRole as UserRole) || roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
