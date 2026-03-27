import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
  role: 'seller' | 'manager' | 'admin';
}

export function useAuth() {
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
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setUser(session.user);
          await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
        }
      } catch (err) {
        // fail
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email, session.user.user_metadata);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    }
  };

  return { user, profile, loading, signOut };
}
