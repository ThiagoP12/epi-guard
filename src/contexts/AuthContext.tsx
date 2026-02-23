import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: { nome: string; email: string; setor: string | null; avatar_url: string | null } | null;
  role: string | null;
  roles: string[];
  empresaAprovada: boolean | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [empresaAprovada, setEmpresaAprovada] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('nome, email, setor, avatar_url')
      .eq('id', userId)
      .single();

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const userRoles = roleData?.map(r => r.role) || [];
    setProfile(profileData);
    setRoles(userRoles);
    // Primary role: super_admin > admin > first available
    const primary = userRoles.includes('super_admin')
      ? 'super_admin'
      : userRoles.includes('admin')
        ? 'admin'
        : userRoles[0] || null;
    setRole(primary);

    // Check if user's empresa is approved
    if (userRoles.includes('super_admin')) {
      setEmpresaAprovada(true);
    } else {
      const { data: links } = await supabase
        .from('user_empresas')
        .select('empresa_id')
        .eq('user_id', userId);

      if (links && links.length > 0) {
        const { data: empresas } = await supabase
          .from('empresas')
          .select('aprovado')
          .in('id', links.map(l => l.empresa_id));

        const anyApproved = empresas?.some(e => e.aprovado) || false;
        setEmpresaAprovada(anyApproved);
      } else {
        // No empresa linked yet
        setEmpresaAprovada(null);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        // Use setTimeout to avoid Supabase auth deadlock, but don't set loading=false until profile is loaded
        setTimeout(async () => {
          if (mounted) {
            await fetchProfile(session.user.id);
            setLoading(false);
          }
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setRoles([]);
        setEmpresaAprovada(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome } },
    });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refetchProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, roles, empresaAprovada, loading, signIn, signUp, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
