'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  ArrowRight,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchClients = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('company_name', { ascending: true });

      if (!error && data) {
        setClients(data);
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();

    // Re-fetch when window gains focus
    window.addEventListener('focus', fetchClients);
    return () => window.removeEventListener('focus', fetchClients);
  }, [user]);

  const filteredClients = clients.filter((c: any) => {
    const search = searchTerm.toLowerCase();
    const name = (c.company_name || '').toLowerCase();
    const trade = (c.trade_name || '').toLowerCase();
    const cnpj = (c.cnpj || '').toLowerCase();
    return name.includes(search) || trade.includes(search) || cnpj.includes(search);
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center no-print sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#00995D]/10 rounded-2xl flex items-center justify-center text-[#00995D]">
            <Users size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Base de Clientes</h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Gerencie sua carteira de empresas e contatos</p>
          </div>
        </div>
        <button 
          onClick={fetchClients}
          className="p-2.5 bg-slate-50 text-slate-400 hover:text-[#00995D] hover:bg-[#00995D]/5 rounded-xl transition-all"
          title="Atualizar lista"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="p-8 space-y-6">
        {/* Barra de Busca */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, fantasia ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00995D] outline-none transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex gap-2">
            <div className="px-4 py-2 bg-[#00995D]/10 text-[#00995D] rounded-xl text-sm font-bold flex items-center gap-2">
              <Building2 size={16} />
              {filteredClients.length} Clientes Cadastrados
            </div>
          </div>
        </div>

        {/* Grid de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded w-full"></div>
                  <div className="h-3 bg-slate-100 rounded w-full"></div>
                </div>
              </div>
            ))
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-[#00995D]/30 hover:shadow-md transition-all group relative overflow-hidden"
              >
                {/* Linha de Status (Simbolismo) */}
                <div className="absolute top-0 right-0 p-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                </div>

                <div className="space-y-5">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-[#00995D]/5 group-hover:text-[#00995D] transition-colors">
                      <Building2 size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 leading-tight group-hover:text-[#00995D] transition-colors line-clamp-2">
                        {client.trade_name || client.company_name}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {client.cnpj ? client.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : '---'}
                      </p>
                    </div>
                  </div>

                  {/* Informações de Contato */}
                  <div className="space-y-3 pt-2 border-t border-slate-50">
                    {client.email && (
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <Mail size={14} />
                        </div>
                        <span className="text-xs font-medium truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                          <Phone size={14} />
                        </div>
                        <span className="text-xs font-medium">{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3 text-slate-500">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={14} />
                      </div>
                      <span className="text-xs font-medium leading-relaxed">
                        {client.address || 'Endereço não informado'}<br />
                        {client.municipio || '---'} / {client.uf || '---'}
                      </span>
                    </div>
                  </div>

                  {/* Ações/Rodapé */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Cadastrado em</span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {mounted ? new Date(client.created_at).toLocaleDateString('pt-BR') : '---'}
                      </span>
                    </div>
                    <Link 
                      href={`/proposals?cnpj=${client.cnpj}`}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-[#00995D] hover:text-white font-bold text-[10px] uppercase transition-all"
                    >
                      Ver Propostas
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Users size={40} />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Nenhum cliente encontrado</h3>
              <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2">
                Comece gerando propostas comerciais para que seus clientes apareçam automaticamente nesta lista.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
