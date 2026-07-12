import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { getAuthSession, setAuthSession } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { can as rbacCan, type Permission } from '@/lib/rbac';
import { generateSecret, otpauthUri } from '@/lib/totp';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export type UserRole = 'admin' | 'accountant' | 'viewer' | 'auditor';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  societyId: string;
  /** ECR-12: whether this account has enrolled an authenticator app (TOTP 2FA). */
  mfaEnabled?: boolean;
  /** ECR-17 Phase 4b: home branch. Set → the user is branch-restricted (sees/enters
   *  only this branch). Unset → society-wide (admin / consolidated). */
  branchId?: string;
}

/** Result of an MFA enrol/disable attempt so the UI can show the right message. */
export type MfaResult = { ok: true } | { ok: false; reason: 'bad-code' | 'save-failed' };

/** Outcome of a login attempt. `mfa` = password OK but a 2FA code is now required.
 *  `reason: 'password_reset_required'` = the password was correct on the legacy
 *  (JWT-less) path, but there is no Supabase Auth session — under tenant RLS such a
 *  session can read nothing, so the user must reset their password to sign in (W-1). */
export type LoginResult = { status: 'ok' | 'mfa' | 'failed'; reason?: 'password_reset_required' };

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  /** ECR-12 — complete a login that returned status 'mfa' by verifying the TOTP code. */
  verifyMfaCode: (code: string) => Promise<boolean>;
  /** ECR-12 — abandon a pending 2FA challenge (user pressed Back). */
  cancelMfa: () => void;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  /** RBAC gate (SL-06): whether the current user's role is granted `permission`. */
  can: (permission: Permission) => boolean;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; isEmailSent: boolean }>;
  /** ECR-12 — generate a fresh TOTP secret + otpauth URI for enrolment (not yet saved). */
  enrollMfa: () => { secret: string; uri: string };
  /** ECR-12 — verify the first code against `secret`, then persist & enable 2FA. */
  confirmMfa: (secret: string, code: string) => Promise<MfaResult>;
  /** ECR-12 — verify a code against the stored secret, then disable 2FA. */
  disableMfa: (code: string) => Promise<MfaResult>;
  /** ECR-12 — admin clears another user's 2FA (lost device). Returns false if not authorised. */
  adminResetMfa: (targetEmail: string) => Promise<boolean>;
  /** ECR-12 — generate a fresh set of one-time recovery codes (needs a current TOTP). */
  generateRecoveryCodes: (code: string) => Promise<string[] | null>;
  /** ECR-12 — complete a pending login using a one-time recovery code. */
  verifyRecoveryCode: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users — DEV-ONLY local login fallback. Gated behind `import.meta.env.DEV`, which
// Vite statically evaluates to `false` in a production build, so this array becomes dead
// code and the plaintext credentials are tree-shaken OUT of the shipped bundle (ECR-30).
// Login also requires localhost (see login() path 4), so production behaviour is unchanged.
const demoUsers: { email: string; password: string; user: User }[] = import.meta.env.DEV ? [
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
] : [];

function buildUser(data: { id: string; name: string; email: string; role: string; society_id: string; mfa_enabled?: boolean; branch_id?: string | null }): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    societyId: data.society_id,
    mfaEnabled: !!data.mfa_enabled,
    branchId: data.branch_id || undefined,   // ECR-17 Phase 4b: home branch (branch-restricted user)
  };
}

function restoreSession(): User | null {
  const session = getAuthSession();
  if (!session) return null;

  // Check demo users — only on localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const found = demoUsers.find(u => u.user.email === session.email);
    if (found) return found.user;
  }

  // Restore from stored session
  if (session.email && session.name && session.role && session.societyId) {
    return {
      id: session.email,
      name: session.name,
      email: session.email,
      role: session.role as UserRole,
      societyId: session.societyId,
      branchId: session.branchId || undefined,   // ECR-17 Phase 4b
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
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(() => {
    const session = getAuthSession();
    return session?.societyId === 'PLATFORM';
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ECR-12 — holds the password-verified user + their TOTP secret between the
  // two login steps. Kept in a ref (never state/localStorage) so a half-finished
  // login cannot be restored or inspected.
  const pendingMfaRef = useRef<{ user: User } | null>(null);

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
            .select('id, name, email, role, society_id, is_active, mfa_enabled, branch_id')
            .eq('email', session.user.email)
            .eq('is_active', true)
            .maybeSingle();

          if (data) {
            const u = buildUser(data);
            setUser(u);
            setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId, branchId: u.branchId });
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

  // ECR-12 — commit a resolved user to the session (shared by both login steps).
  const completeLogin = useCallback((u: User) => {
    setUser(u);
    setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId, branchId: u.branchId });
    checkSuperAdmin(u.email).then(setIsSuperAdmin);
  }, []);

  // ECR-12 — after a correct password on a society_users path, require a TOTP code
  // if the account has 2FA enrolled; otherwise finish the login immediately.
  const finishOrChallenge = useCallback(async (u: User): Promise<LoginResult> => {
    try {
      const { data } = await supabase
        .from('society_users')
        .select('mfa_enabled')
        .eq('email', u.email)
        .maybeSingle();
      if ((data as { mfa_enabled?: boolean } | null)?.mfa_enabled) {
        // Only the flag is read here — the secret stays server-side (ECR-12 s3).
        pendingMfaRef.current = { user: { ...u, mfaEnabled: true } };
        return { status: 'mfa' };
      }
    } catch {
      // Supabase unreachable — cannot read the flag, so MFA can't be enforced
      // (fail-open on offline; in production Supabase is always reachable here).
    }
    completeLogin(u);
    return { status: 'ok' };
  }, [completeLogin]);

  const verifyMfaCode = useCallback(async (code: string): Promise<boolean> => {
    const pending = pendingMfaRef.current;
    if (!pending) return false;
    try {
      // Server-side verify — the secret never reaches the client (ECR-12 s3).
      const { data, error } = await supabase.rpc('app_verify_mfa', { p_email: pending.user.email, p_code: code });
      if (error || data !== true) return false;
    } catch {
      return false; // offline → cannot verify → fail closed.
    }
    completeLogin(pending.user);
    pendingMfaRef.current = null;
    return true;
  }, [completeLogin]);

  const cancelMfa = useCallback(() => { pendingMfaRef.current = null; }, []);

  const adminResetMfa = useCallback(async (targetEmail: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc('app_mfa_admin_reset', { p_admin_email: user.email, p_target_email: targetEmail });
      return !error && data === true;
    } catch {
      return false;
    }
  }, [user]);

  const generateRecoveryCodes = useCallback(async (code: string): Promise<string[] | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc('app_mfa_gen_recovery', { p_email: user.email, p_code: code });
      if (error || !Array.isArray(data)) return null;
      return data as string[];
    } catch {
      return null;
    }
  }, [user]);

  const verifyRecoveryCode = useCallback(async (code: string): Promise<boolean> => {
    const pending = pendingMfaRef.current;
    if (!pending) return false;
    try {
      const { data, error } = await supabase.rpc('app_verify_recovery', { p_email: pending.user.email, p_code: code });
      if (error || data !== true) return false;
    } catch {
      return false;
    }
    completeLogin(pending.user);
    pendingMfaRef.current = null;
    return true;
  }, [completeLogin]);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    // 1. Try Supabase Auth (signInWithPassword — JWT based)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (!authError && authData.user) {
        const { data: userData } = await supabase
          .from('society_users')
          .select('id, name, email, role, society_id, is_active, mfa_enabled, branch_id')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();

        if (userData) {
          return await finishOrChallenge(buildUser(userData));
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
          setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId, branchId: u.branchId });
          return { status: 'ok' };
        }
      }
    } catch {
      // Supabase unreachable — fall through
    }

    // 2. Direct platform_admins password check (super admin login)
    try {
      const { data: adminData } = await supabase
        .rpc('verify_platform_admin', { p_email: email, p_password: password })
        .maybeSingle();

      if (adminData) {
        const admin = adminData as { name?: string };
        const u: User = {
          id: email,
          name: admin.name || email.split('@')[0],
          email,
          role: 'admin',
          societyId: 'PLATFORM',
        };
        setUser(u);
        setIsSuperAdmin(true);
        setAuthSession({ email: u.email, name: u.name, role: u.role, societyId: u.societyId, branchId: u.branchId });
        return { status: 'ok' };
      }
    } catch {
      // Supabase unreachable — fall through
    }

    // 3. (RETIRED — P1-SEC-4) The legacy JWT-less app_login RPC path was removed.
    //    It established no Supabase Auth session, so under tenant RLS (P1-SEC-1b) it
    //    could never complete a usable login (W-1 already made it a dead-end that
    //    only told users to reset). Every active user is enrolled in Supabase Auth
    //    (jwt_less_legacy = 0), so path 1 covers them, and the app_login RPC — which
    //    verified plain-text passwords server-side — is dropped. A user whose Auth
    //    is somehow unavailable resets their password (enrolling them in Auth →
    //    path 1). `reason: 'password_reset_required'` is retained on LoginResult for
    //    the reset-flow messaging but is no longer emitted here.

    // 4. Demo users — ONLY on localhost (disabled in production for security)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
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
        return { status: 'ok' };
      }
    }

    return { status: 'failed' };
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
      // First try Supabase Auth reset (works if user is in Supabase Auth)
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      console.info('[Auth] Password reset response:', { data, error: error?.message });
      if (!error) {
        return { success: true, isEmailSent: true };
      }
      console.error('[Auth] Password reset error:', error.message);

      // If Supabase Auth fails (user might be on legacy plain-text auth),
      // try to sign them up in Supabase Auth first, then reset.
      // W-2: under tenant RLS this UNAUTHENTICATED society_users read resolves to
      // NULL (no JWT → get_current_society_id() is NULL), so `legacyUser` is null
      // and this legacy self-migration branch is inert. That is acceptable and
      // safer — it also closes an email-enumeration vector. Per the P1-SEC-1b
      // precondition every user is already on Supabase Auth, so no legacy user
      // reaches here; any straggler is handled via Admin reset (isEmailSent:false).
      if (error.message?.includes('Unable to process') || error.status === 500) {
        // Check if user exists in society_users (legacy auth) — RLS-gated (see W-2).
        const { data: legacyUser } = await supabase
          .from('society_users')
          .select('email, name')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();

        if (legacyUser) {
          // User is on legacy auth — create in Supabase Auth with a temp password
          const tempPassword = `Temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password: tempPassword,
            options: { data: { name: legacyUser.name } },
          });
          console.info('[Auth] Legacy user sign-up attempt:', { email, signUpError: signUpError?.message });

          if (!signUpError) {
            // Now try reset again
            const { error: retryError } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (!retryError) {
              return { success: true, isEmailSent: true };
            }
            console.error('[Auth] Retry reset error:', retryError.message);
          }

          // Even if Supabase Auth signup failed, the user can still use Admin reset
          return { success: true, isEmailSent: false };
        }
      }
    } catch (err) {
      console.error('[Auth] Password reset exception:', err);
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

  // SL-06: adopt the rbac permission model. Maps the current (legacy) role through
  // rbac.mapLegacyRole → PERMISSION_MATRIX. Additive — hasPermission is left untouched.
  const can = (permission: Permission): boolean => {
    if (!user) return false;
    return rbacCan(user.role, permission);
  };

  // ECR-12 — TOTP 2FA enrolment. Enrol/confirm/disable only; login is NOT yet
  // gated on MFA (that is a later slice), so no existing user can be locked out.
  const enrollMfa = useCallback((): { secret: string; uri: string } => {
    const secret = generateSecret();
    return { secret, uri: otpauthUri(secret, user?.email || 'user') };
  }, [user]);

  const confirmMfa = useCallback(async (secret: string, code: string): Promise<MfaResult> => {
    if (!user) return { ok: false, reason: 'save-failed' };
    try {
      // Server verifies the code and stores the secret in the locked user_mfa
      // table (SECURITY DEFINER) — the client never writes the secret (ECR-12 s3).
      const { data, error } = await supabase.rpc('app_mfa_enroll', { p_email: user.email, p_secret: secret, p_code: code });
      if (error) return { ok: false, reason: 'save-failed' };
      if (data !== true) return { ok: false, reason: 'bad-code' };
    } catch {
      return { ok: false, reason: 'save-failed' };
    }
    setUser(u => (u ? { ...u, mfaEnabled: true } : u));
    return { ok: true };
  }, [user]);

  const disableMfa = useCallback(async (code: string): Promise<MfaResult> => {
    if (!user) return { ok: false, reason: 'save-failed' };
    try {
      const { data, error } = await supabase.rpc('app_mfa_disable', { p_email: user.email, p_code: code });
      if (error) return { ok: false, reason: 'save-failed' };
      if (data !== true) return { ok: false, reason: 'bad-code' };
    } catch {
      return { ok: false, reason: 'save-failed' };
    }
    setUser(u => (u ? { ...u, mfaEnabled: false } : u));
    return { ok: true };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isSuperAdmin, login, verifyMfaCode, cancelMfa, logout, hasPermission, can, sendPasswordReset, enrollMfa, confirmMfa, disableMfa, adminResetMfa, generateRecoveryCodes, verifyRecoveryCode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
