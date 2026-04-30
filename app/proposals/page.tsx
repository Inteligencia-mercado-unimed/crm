'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Search, Filter, ArrowUpDown, ChevronDown, ChevronUp, Users, Info, Building2, User, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function ProposalsPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando propostas...</div>}>
      <ProposalsContent />
    </Suspense>
  );
}

function ProposalsContent() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const cnpjParam = searchParams.get('cnpj');

  useEffect(() => {
    if (cnpjParam) {
      setSearchTerm(cnpjParam);
    }
  }, [cnpjParam]);

  const fetchProposals = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setAllRows(data);
          // Group by proposal number for main list
          const uniqueProposalsList: any[] = [];
          const seen = new Set();
          (data as any[]).forEach((p: any) => {
            const id = p.proposal_number || p.proposalNumber;
            if (!seen.has(id)) {
              seen.add(id);
              uniqueProposalsList.push(p);
            }
          });
          setProposals(uniqueProposalsList);
        }
      } else {
        const localHistory = JSON.parse(localStorage.getItem('unimed_proposals_history') || '[]');
        setProposals(localHistory);
        setAllRows(localHistory);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();

    // Re-fetch when window gains focus
    window.addEventListener('focus', fetchProposals);
    return () => window.removeEventListener('focus', fetchProposals);
  }, [user]);

  const filteredProposals = proposals.filter((p: any) => {
    const search = searchTerm.toLowerCase();
    const company = (p.company_name || p.companyName || '').toLowerCase();
    const seller = (p.seller_name || p.sellerName || '').toLowerCase();
    const number = (p.proposal_number || p.proposalNumber || '').toLowerCase();
    const cnpj = (p.cnpj || '').toLowerCase();
    
    // Versão limpa para busca flexível
    const cleanSearch = search.replace(/\D/g, '');
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    return (
      company.includes(search) || 
      seller.includes(search) || 
      number.includes(search) || 
      cnpj.includes(search) ||
      (cleanSearch !== '' && cleanCNPJ.includes(cleanSearch))
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const AGE_ORDER = [
    "De 0 a 18 anos.",
    "De 19 a 23 anos.",
    "De 24 a 28 anos.",
    "De 29 a 33 anos.",
    "De 34 a 38 anos.",
    "De 39 a 43 anos.",
    "De 44 a 48 anos.",
    "De 49 a 53 anos.",
    "De 54 a 58 anos.",
    "Acima de 59 anos."
  ];

  const getProposalDetails = (proposalNum: string) => {
    const rows = allRows.filter(r => (r.proposal_number || r.proposalNumber) === proposalNum);
    return rows.sort((a, b) => {
      // 1. Abrangência (ESTADUAL vs REGIONAL)
      if (a.coverage !== b.coverage) return a.coverage.localeCompare(b.coverage);
      // 2. Acomodação (APARTAMENTO vs ENFERMARIA)
      if (a.accommodation !== b.accommodation) return a.accommodation.localeCompare(b.accommodation);
      // 3. Faixa Etária (Ordem cronológica)
      const idxA = AGE_ORDER.indexOf(a.age_group || a.ageGroup);
      const idxB = AGE_ORDER.indexOf(b.age_group || b.ageGroup);
      return idxA - idxB;
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#00995D]/10 rounded-2xl flex items-center justify-center text-[#00995D]">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Propostas Comerciais</h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Gerencie e visualize todas as propostas emitidas</p>
          </div>
        </div>
      </div>

      <main className="p-8 space-y-6">
        {/* Filtros e Busca */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por empresa, vendedor ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00995D] outline-none transition-all text-sm font-medium"
            />
          </div>
          
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
              <Filter size={18} />
              Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
              <ArrowUpDown size={18} />
              Ordenar
            </button>
          </div>
        </div>

        {/* Tabela de Propostas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-10"></th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Nº Proposta</th>
                  <th className="px-6 py-4">Data Emissão</th>
                  <th className="px-6 py-4">Empresa / Contratante</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4">Vidas</th>
                  <th className="px-6 py-4">Valor Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : filteredProposals.length > 0 ? (
                  filteredProposals.map((prop, idx) => {
                    const propNum = prop.proposal_number || prop.proposalNumber;
                    const isExpanded = expandedId === propNum;
                    const details = getProposalDetails(propNum);
                    
                    return (
                      <React.Fragment key={idx}>
                        <tr 
                          onClick={() => setExpandedId(isExpanded ? null : propNum)}
                          className={`hover:bg-slate-50 transition-all cursor-pointer group ${isExpanded ? 'bg-[#00995D]/5' : ''}`}
                        >
                          <td className="px-6 py-4 text-slate-400">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold uppercase">Emitida</span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-[#00995D]">
                            #{propNum}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-500">
                            {prop.date || new Date(prop.created_at).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{prop.company_name || prop.companyName || 'Sem Nome'}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">{prop.cnpj || '---'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                {(prop.seller_name || prop.sellerName || '---').substring(0,2).toUpperCase()}
                              </div>
                              <span className="font-medium">{prop.seller_name || prop.sellerName || '---'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">
                            {prop.total_lives || prop.totalLives || 0}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-900">
                            {formatCurrency(prop.total_value || prop.totalValue || 0)}
                          </td>
                        </tr>
                        
                        {/* Detalhes Expandidos */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0 border-b border-slate-200">
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="bg-slate-50/50 p-8"
                              >
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                  {/* Coluna 1: Info da Empresa */}
                                  <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Building2 size={14} className="text-[#00995D]" />
                                        Informações da Empresa
                                      </h4>
                                      <div className="space-y-3">
                                        <div>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Razão Social</p>
                                          <p className="text-sm font-bold text-slate-700">{prop.company_name || prop.companyName}</p>
                                        </div>
                                        <div>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Responsável</p>
                                          <p className="text-sm font-bold text-slate-700">{prop.responsible || '---'}</p>
                                        </div>
                                        <div>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Validade da Proposta</p>
                                          <p className="text-sm font-bold text-slate-700">{prop.validity_days || 20} dias</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Info size={14} className="text-[#00995D]" />
                                        Resumo Financeiro
                                      </h4>
                                      <div className="space-y-3">
                                        <div className="flex justify-between">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase">Desconto Aplicado</p>
                                          <p className="text-sm font-black text-[#00995D]">{prop.discount || 0}%</p>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-100 pt-3">
                                          <p className="text-[10px] font-bold text-slate-400 uppercase">Valor Mensal Total</p>
                                          <p className="text-lg font-black text-slate-900">{formatCurrency(prop.total_value || prop.totalValue || 0)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Coluna 2: Detalhamento de Vidas e Planos */}
                                  <div className="lg:col-span-8 space-y-6">
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                          <Users size={14} className="text-[#00995D]" />
                                          Vidas por Faixa Etária
                                        </h4>
                                        <span className="bg-[#00995D] text-white text-[10px] font-black px-2 py-1 rounded-md">{prop.total_lives || prop.totalLives} VIDAS</span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-tighter bg-slate-50/30">
                                              <th className="px-6 py-3">Abrangência</th>
                                              <th className="px-6 py-3">Acomodação</th>
                                              <th className="px-6 py-3">Faixa Etária</th>
                                              <th className="px-6 py-3 text-center">Vidas</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {details.map((detail, dIdx) => (
                                              <tr key={dIdx} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-3">
                                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${
                                                    detail.coverage === 'REGIONAL' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                  }`}>
                                                    {detail.coverage}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-3 font-bold text-slate-600">{detail.accommodation}</td>
                                                <td className="px-6 py-3 text-slate-600 font-medium">{detail.age_group || detail.ageGroup}</td>
                                                <td className="px-6 py-3 text-center">
                                                  <span className="bg-slate-100 px-2 py-1 rounded-md font-black text-slate-700">
                                                    {detail.lives_count || 1}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Nenhuma proposta encontrada com estes critérios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

