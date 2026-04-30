'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Login } from './Login';
import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Se estiver carregando a autenticação, mostra um spinner central
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-[#00995D]" size={48} />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Carregando CRM...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado, mostra apenas a tela de Login
  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar fixa à esquerda */}
      <Sidebar />
      
      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
