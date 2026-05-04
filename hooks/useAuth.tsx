'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
  role: 'seller' | 'manager' | 'admin';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email?: string, metadata?: any) => {
    if (!supabase) return;
    try {
      // Prioridade máxima: Metadados do Auth (Authentication do Supabase)
      const authName = metadata?.full_name || metadata?.name || metadata?.display_name;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      // Prioridade: Auth Name (Metadata) > Table Name
      const finalName = authName || data?.full_name || data?.name || 'Usuário Sem Nome';

      setProfile({
        id: data?.id || userId,
        full_name: finalName.toUpperCase(),
        phone_number: data?.phone_number || '',
        role: data?.role || 'seller'
      });

      // Tentar por email se for necessário (caso data esteja vazio)
      if (!data && email && !authName) {
        const { data: emailData } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        
        if (emailData) {
          setProfile({
            id: emailData.id,
            full_name: emailData.full_name || emailData.name || 'Usuário Sem Nome',
            phone_number: emailData.phone_number,
            role: emailData.role
          });
        }
      }
    } catch (e) {
      // Quiet fail
    }
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;

    // Safety timeout: Never stay loading more than 6 seconds
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Auth loading timed out. Forcing ready state.');
        setLoading(false);
      }
    }, 6000);

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session && isMounted) {
          setUser(session.user);
          // Don't await fetchProfile to avoid blocking the main UI if DB is slow
          fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (!isMounted) return;
      
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
      clearTimeout(timeoutId);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
