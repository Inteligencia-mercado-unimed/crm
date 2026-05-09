'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Login } from './Login';
import { Loader2, BellDot, User, ArrowRight } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showNotification, setShowNotification] = useState<any>(null);

  // --- Global Real-time Notifications ---
  useEffect(() => {
    if (!user || !profile) return;

    // Load initial counts
    const fetchPending = async () => {
      let query = supabase.from('proposals').select('*');
      
      if (profile.role === 'manager' || profile.role === 'admin') {
        // Manager sees all pending
        query = query.eq('status', 'pending');
      } else {
        // Seller sees their approved by manager
        query = query.eq('status', 'manager_approved').eq('seller_id', user.id);
      }

      const { data: pending } = await query.order('created_at', { ascending: false });
      
      if (pending) {
        // Group by proposal_number to count unique proposals
        const unique = [];
        const seen = new Set();
        for (const p of pending) {
          if (!seen.has(p.proposal_number)) {
            seen.add(p.proposal_number);
            unique.push(p);
          }
        }
        setPendingRequests(unique);
      }
    };
    fetchPending();

    // Subscribe to changes
    const channel = supabase
      .channel('global_notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals' },
        (payload: any) => {
          // MANAGER logic: New pending proposal
          if (
            (profile.role === 'manager' || profile.role === 'admin') &&
            payload.eventType === 'INSERT' && 
            payload.new.status === 'pending'
          ) {
            setShowNotification({ ...payload.new, type: 'manager' });
            setPendingRequests(prev => [payload.new, ...prev]);
          } 
          // SELLER logic: Manager approved a discount
          else if (
            profile.role === 'seller' &&
            payload.eventType === 'UPDATE' &&
            payload.new.status === 'manager_approved' &&
            payload.new.seller_id === user.id &&
            payload.old.status !== 'manager_approved'
          ) {
            setShowNotification({ ...payload.new, type: 'seller' });
            fetchPending();
          }
          // Generic refresh for removals/other updates
          else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            fetchPending();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

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
      {/* Sidebar fixa à esquerda - Passando contagem de notificações */}
      <Sidebar pendingCount={pendingRequests.length} />
      
      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        {children}
      </main>

      {/* Pop-up de Nova Solicitação Global */}
      <AnimatePresence>
        {showNotification && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md no-print">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="bg-white rounded-[32px] shadow-2xl border border-amber-100 p-8 max-w-sm w-full space-y-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
              
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto text-amber-500 shadow-inner">
                {showNotification.type === 'seller' ? (
                  <ShieldCheck size={40} className="text-[#00995D]" />
                ) : (
                  <BellDot size={40} className="animate-pulse" />
                )}
              </div>

              <div className="text-center space-y-2">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${showNotification.type === 'seller' ? 'text-[#00995D]' : 'text-amber-600'}`}>
                  {showNotification.type === 'seller' ? 'Desconto Aprovado' : 'Nova Solicitação'}
                </p>
                <h3 className="text-xl font-black text-slate-800 leading-tight">
                  {showNotification.type === 'seller' ? 'Proposta Liberada' : 'Desconto Pendente'}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {showNotification.type === 'seller' ? (
                    <>Sua solicitação para <span className="font-bold text-slate-700">{showNotification.company_name}</span> foi aprovada pelo gestor. Você já pode gerar a proposta!</>
                  ) : (
                    <>A empresa <span className="font-bold text-slate-700">{showNotification.company_name}</span> solicita um desconto de <span className="text-amber-600 font-black">{showNotification.requested_discount}%</span>.</>
                  )}
                </p>
              </div>

              {showNotification.type === 'manager' && (
                <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-100">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Vendedor</p>
                      <p className="text-xs font-black text-slate-700">{showNotification.seller_name}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNotification(null)}
                  className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all text-sm"
                >
                  Depois
                </button>
                <button
                  onClick={() => {
                    setShowNotification(null);
                    router.push('/'); // Redireciona para a página de propostas onde fica o arquivo
                  }}
                  className="flex-2 px-6 py-3 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/30 transition-all text-sm flex items-center gap-2"
                >
                  Ver Solicitação
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
