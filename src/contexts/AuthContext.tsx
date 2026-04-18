import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { UserProfile, ModuleLevel } from '../types';
import { supabase } from '../lib/supabase';

type ModuleName = 'crm' | 'philanthropy' | 'advoLink';

const MODULE_LEVEL_RANK: Record<ModuleLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

interface AuthContextType {
  // Real identity (always the logged-in user)
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  subordinateIds: string[];
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasModule: (module: ModuleName) => boolean;
  getModuleLevel: (module: ModuleName) => ModuleLevel;
  hasModuleLevel: (module: ModuleName, min: ModuleLevel) => boolean;
  canEditModule: (module: ModuleName) => boolean;
  canAdminModule: (module: ModuleName) => boolean;

  // Impersonation
  isImpersonating: boolean;
  impersonatedProfile: UserProfile | null;
  startImpersonating: (userId: string) => Promise<void>;
  stopImpersonating: () => void;

  // Effective identity (impersonated user when active, real user otherwise)
  // Use for READ queries and display. Use user!.id for WRITES (created_by).
  effectiveUserId: string | null;
  effectiveProfile: UserProfile | null;
  effectiveIsAdmin: boolean;
  effectiveIsManager: boolean;
  effectiveSubordinateIds: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subordinateIds, setSubordinateIds] = useState<string[]>([]);

  // Impersonation state
  const [impersonatedProfile, setImpersonatedProfile] = useState<UserProfile | null>(null);
  const [impersonatedSubordinateIds, setImpersonatedSubordinateIds] = useState<string[]>([]);

  const fetchProfile = async (userId: string, silent = false) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Failed to fetch profile:', error);
        // If silent (background refresh), keep existing profile to avoid unmounting
        if (!silent) setProfile(null);
        return;
      }

      if (data && !data.is_active) {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        return;
      }

      setProfile(data as UserProfile);

      // Fetch subordinate IDs
      await fetchSubordinates(userId);
    } catch {
      // If silent (background refresh), keep existing profile
      if (!silent) setProfile(null);
    }
  };

  const fetchSubordinates = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_subordinate_ids', { manager_uuid: userId });

      if (error) {
        console.error('Failed to fetch subordinates:', error);
        setSubordinateIds([]);
        return;
      }

      // RPC returns array of UUIDs
      const ids = (data || []).map((row: any) =>
        typeof row === 'string' ? row : row
      );
      setSubordinateIds(ids);
    } catch {
      setSubordinateIds([]);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  // Use a ref to access current profile without adding it to effect deps
  const profileRef = React.useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    // Hydrate from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setLoading(false));
        supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', session.user.id).then(() => {});
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes (token refresh, sign-in, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setSession(session);
        setUser(session.user);

        if (profileRef.current) {
          // Already have a loaded profile (e.g. desktop switch, token refresh).
          // Silently refresh — never touch loading to avoid unmounting forms.
          fetchProfile(session.user.id, true);
        } else {
          // No profile yet (fresh sign-in). Show loading and fetch properly.
          setLoading(true);
          fetchProfile(session.user.id).then(() => setLoading(false));
        }

        if (event === 'SIGNED_IN') {
          supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', session.user.id).then(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        // Only clear state on explicit sign-out
        setSession(null);
        setUser(null);
        setProfile(null);
        setSubordinateIds([]);
        setLoading(false);
      }
      // Ignore transient null-session events (TOKEN_REFRESHED glitches, etc.)
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    stopImpersonating();
    await supabase.auth.signOut();
    setProfile(null);
    setSubordinateIds([]);
  };

  // Impersonation functions
  const startImpersonating = async (targetUserId: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch impersonation target:', error);
      return;
    }

    const { data: subData } = await supabase
      .rpc('get_subordinate_ids', { manager_uuid: targetUserId });
    const subIds = (subData || []).map((row: any) =>
      typeof row === 'string' ? row : row
    );

    setImpersonatedProfile(data as UserProfile);
    setImpersonatedSubordinateIds(subIds);
  };

  const stopImpersonating = () => {
    setImpersonatedProfile(null);
    setImpersonatedSubordinateIds([]);
  };

  // Real identity
  const isAdmin = profile?.role === 'admin';
  const isManager = subordinateIds.length > 0;

  // Impersonation derived
  const isImpersonating = impersonatedProfile !== null;
  const effectiveUserId = impersonatedProfile?.id || user?.id || null;
  const effectiveProfile = impersonatedProfile || profile;
  const effectiveSubordinateIds = isImpersonating ? impersonatedSubordinateIds : subordinateIds;
  const effectiveIsManager = isImpersonating
    ? impersonatedSubordinateIds.length > 0
    : isManager;
  const effectiveIsAdmin = isImpersonating
    ? impersonatedProfile?.role === 'admin'
    : isAdmin;

  // Resolve a user's level for a given module. Admins always get 'admin'.
  // Stored values may still be booleans (pre-migration) — normalize them here
  // so the UI continues to work even before migration 033 has run.
  const getModuleLevel = (module: ModuleName): ModuleLevel => {
    if (effectiveIsAdmin) return 'admin';
    const raw = effectiveProfile?.module_access?.[module];
    if (raw === 'none' || raw === 'view' || raw === 'edit' || raw === 'admin') return raw;
    // Legacy boolean fallback
    if (raw === true || (raw as any) === 'true') return 'edit';
    return 'none';
  };

  const hasModuleLevel = (module: ModuleName, min: ModuleLevel): boolean =>
    MODULE_LEVEL_RANK[getModuleLevel(module)] >= MODULE_LEVEL_RANK[min];

  // Backward-compatible: "has module" means at least view access
  const hasModule = (module: ModuleName): boolean => hasModuleLevel(module, 'view');
  const canEditModule = (module: ModuleName): boolean => hasModuleLevel(module, 'edit');
  const canAdminModule = (module: ModuleName): boolean => hasModuleLevel(module, 'admin');

  const value = useMemo(() => ({
    user, profile, session, loading, isAdmin, isManager, subordinateIds,
    signIn, signOut, refreshProfile,
    hasModule, getModuleLevel, hasModuleLevel, canEditModule, canAdminModule,
    // Impersonation
    isImpersonating, impersonatedProfile,
    startImpersonating, stopImpersonating,
    effectiveUserId, effectiveProfile,
    effectiveIsAdmin, effectiveIsManager, effectiveSubordinateIds,
  }), [
    user, profile, session, loading, isAdmin, isManager, subordinateIds,
    isImpersonating, impersonatedProfile,
    effectiveUserId, effectiveProfile,
    effectiveIsAdmin, effectiveIsManager, effectiveSubordinateIds,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
