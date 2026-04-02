'use client';

import React, { useState, useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import {
  Download,
  Printer,
  Plus,
  Minus,
  Building2,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  Info,
  ShieldCheck,
  Clock,
  MapPin,
  Search,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Login } from '@/components/Login';
import { LogOut, Shield, User as UserIcon, Loader2 } from 'lucide-react';

// --- Types ---
interface PlanAgeGroup {
  label: string;
  value: number;
  consulta: string;
  exame: string;
  franquia: number;
}

interface Plan {
  ans: string;
  type: string;
  coverage: string;
  accommodation: string;
  segmentation: string;
  moderator: string;
  ageGroups: PlanAgeGroup[];
}

interface ProposalData {
  proposalNumber: string;
  cnpj: string;
  companyName: string;
  responsible: string;
  sellerName: string;
  seller_id: string;
  validityDays: number;
  discount: number;
  municipio?: string;
  situacao?: string;
}

export default function UnimedProposalGenerator() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [data, setData] = useState<ProposalData>({
    proposalNumber: '',
    cnpj: '',
    companyName: '',
    responsible: '',
    sellerName: '',
    seller_id: '',
    validityDays: 20,
    discount: 0,
  });
  const [selectedCoverages, setSelectedCoverages] = useState<string[]>([]);
  const [selectedAccommodations, setSelectedAccommodations] = useState<string[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Sync profile data to proposal data
  useEffect(() => {
    if (profile) {
      const finalName = (profile.full_name || '').toUpperCase();

      console.log('Sincronizando consultor pelo perfil:', { fullName: profile.full_name });

      setData(prev => ({
        ...prev,
        sellerName: finalName,
        seller_id: profile.id
      }));
    }
  }, [profile]);

  // Load history on mount
  useEffect(() => {
    if (!user) return;

    const loadHistory = async () => {
      // Try Supabase first
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          const { data: supabaseHistory, error } = await supabase
            .from('proposals')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

          if (!error && supabaseHistory) {
            const uniqueProposals: any[] = [];
            const seen = new Set();
            
            supabaseHistory.forEach((p: any) => {
              if (!seen.has(p.proposal_number)) {
                seen.add(p.proposal_number);
                uniqueProposals.push({
                  ...p,
                  proposalNumber: p.proposal_number,
                  companyName: p.company_name,
                  sellerName: p.seller_name,
                  totalLives: p.total_lives,
                  totalValue: p.total_value,
                  discount: p.discount || 0
                });
              }
            });
            setHistory(uniqueProposals.slice(0, 10));
            return;
          }
        } catch (err) {
          // quiet
        }
      }

      // Fallback to localStorage (only if not using Supabase)
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const savedHistory = JSON.parse(localStorage.getItem('unimed_proposals_history') || '[]');
        setHistory(savedHistory.slice().reverse().slice(0, 5));
      }
    };

    loadHistory();
  }, [user, profile]);

  // Fetch Plans from CSV
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/plans');
        const result = await response.json();
        if (Array.isArray(result)) {
          setPlans(result);

          // Initialize quantities for all unique age groups
          const uniqueAgeGroups = Array.from(new Set(result.flatMap((p: Plan) => p.ageGroups.map(ag => ag.label))));
          const initialQuantities: Record<string, number> = {};
          uniqueAgeGroups.forEach(label => {
            initialQuantities[label as string] = 0;
          });
          setQuantities(initialQuantities);

          // Initialize filters with all options selected
          const coverages = Array.from(new Set(result.map((p: Plan) => p.coverage))) as string[];
          const accommodations = Array.from(new Set(result.map((p: Plan) => p.accommodation))) as string[];
          setSelectedCoverages(coverages);
          setSelectedAccommodations(accommodations);
        }
      } catch (error) {
        // quiet
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Load/Generate Proposal Number
  useEffect(() => {
    const lastNum = localStorage.getItem('unimed_last_proposal_number');
    const nextNum = lastNum ? (parseInt(lastNum) + 1).toString().padStart(4, '0') : '2736';
    setData(prev => ({ ...prev, proposalNumber: nextNum }));
  }, []);

  const formatCNPJ = (v: string) => {
    v = v.replace(/\D/g, '');
    if (v.length <= 2) return v;
    if (v.length <= 5) return v.replace(/^(\d{2})(\d)/, '$1.$2');
    if (v.length <= 8) return v.replace(/^(\d{2})(\d{3})(\d)/, '$1.$2.$3');
    if (v.length <= 12) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d)/, '$1.$2.$3/$4');
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d)/, '$1.$2.$3/$4-$5').substring(0, 18);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === 'cnpj') {
      value = formatCNPJ(value);
      const cleanCNPJ = value.replace(/\D/g, '');
      if (cleanCNPJ.length === 14) {
        handleCNPJLookup(cleanCNPJ);
      }
    }

    let finalValue: string | number = value;
    if (name === 'discount' || name === 'validityDays') {
      finalValue = value === '' ? 0 : parseFloat(value);
    }

    setData(prev => ({ ...prev, [name]: finalValue }));
  };

  const handleCNPJLookup = async (cnpj: string) => {
    setIsSearchingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (response.ok) {
        const result = await response.json();
        setData(prev => ({
          ...prev,
          companyName: result.razao_social,
          municipio: result.municipio,
          situacao: result.descricao_situacao_cadastral
        }));
      }
    } catch (error) {
      // quiet
    } finally {
      setIsSearchingCNPJ(false);
    }
  };

  const updateQuantity = (label: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [label]: Math.max(0, (prev[label] || 0) + delta)
    }));
  };

  const toggleFilter = (type: 'coverage' | 'accommodation', value: string) => {
    if (type === 'coverage') {
      setSelectedCoverages(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    } else {
      setSelectedAccommodations(prev =>
        prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
      );
    }
  };

  const filteredPlans = plans.filter(p =>
    selectedCoverages.includes(p.coverage) &&
    selectedAccommodations.includes(p.accommodation)
  );

  const formatANS = (ans: string) => {
    if (!ans) return '---';
    const clean = ans.replace(/\D/g, '');
    if (clean.length === 9) {
      return clean.replace(/^(\d{3})(\d{3})(\d{2})(\d{1})/, '$1.$2.$3-$4');
    }
    return ans;
  };

  const calculatePlanTotal = (plan: Plan) => {
    return plan.ageGroups.reduce((acc, group) => {
      const discountedValue = Math.round(group.value * (1 - (data.discount / 100)));
      return acc + (discountedValue * (quantities[group.label] || 0));
    }, 0);
  };

  const calculateOriginalPlanTotal = (plan: Plan) => {
    return plan.ageGroups.reduce((acc, group) => acc + (group.value * (quantities[group.label] || 0)), 0);
  };

  const calculateTotalLives = () => {
    return Object.values(quantities).reduce((acc, q) => acc + q, 0);
  };

  const handleGenerateProposal = async () => {
    const element = document.getElementById('proposal-document-container');
    if (!element) return;
    setIsGenerating(true);

    // 1. Preparar dados detalhados para o Banco de Dados
    const proposalRows: any[] = [];
    const filteredPlans = plans.filter(p => 
      selectedCoverages.includes(p.coverage) && 
      selectedAccommodations.includes(p.accommodation)
    );

    filteredPlans.forEach(plan => {
      Object.entries(quantities).forEach(([ageGroup, count]) => {
        if (count > 0) {
          proposalRows.push({
            proposal_number: data.proposalNumber,
            cnpj: data.cnpj,
            company_name: data.companyName,
            responsible: data.responsible,
            seller_name: data.sellerName,
            seller_id: user?.id,
            validity_days: data.validityDays,
            discount: data.discount,
            date: format(new Date(), 'dd/MM/yyyy'),
            plan_type: plan.type,
            coverage: plan.coverage,
            accommodation: plan.accommodation,
            age_group: ageGroup,
            lives_count: count,
            total_lives: calculateTotalLives(),
            total_value: plans.reduce((acc, p) => acc + calculatePlanTotal(p), 0)
          });
        }
      });
    });

    // Se não houver vidas selecionadas, salvar ao menos o cabeçalho
    if (proposalRows.length === 0) {
      proposalRows.push({
        proposal_number: data.proposalNumber,
        cnpj: data.cnpj,
        company_name: data.companyName,
        responsible: data.responsible,
        seller_name: data.sellerName,
        seller_id: user?.id,
        validity_days: data.validityDays,
        discount: data.discount,
        date: format(new Date(), 'dd/MM/yyyy'),
        total_lives: calculateTotalLives(),
        total_value: plans.reduce((acc, p) => acc + calculatePlanTotal(p), 0)
      });
    }

    // Try Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const { error } = await supabase.from('proposals').insert(proposalRows);
        if (error) throw error;

        // Refresh history from Supabase (pegar as mais recentes baseadas no número da proposta único ou data)
        const { data: freshHistory } = await supabase
          .from('proposals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        if (freshHistory) {
          // Agrupar para exibição no histórico (mostrar apenas uma entrada por número de proposta)
          const uniqueProposals: any[] = [];
          const seen = new Set();
          
          freshHistory.forEach((p: any) => {
            if (!seen.has(p.proposal_number)) {
              seen.add(p.proposal_number);
              uniqueProposals.push({
                ...p,
                proposalNumber: p.proposal_number,
                companyName: p.company_name,
                sellerName: p.seller_name,
                totalLives: p.total_lives,
                totalValue: p.total_value,
                discount: p.discount || 0
              });
            }
          });
          setHistory(uniqueProposals.slice(0, 10));
        }
      } catch (err) {
        // quiet
      }
    }

    // Always save to localStorage as backup/fallback
    const localHistory = JSON.parse(localStorage.getItem('unimed_proposals_history') || '[]');
    const newProposal = {
      ...data,
      id: Date.now(),
      totalLives: calculateTotalLives(),
      totalValue: plans.reduce((acc, plan) => acc + calculatePlanTotal(plan), 0)
    };
    localHistory.push(newProposal);
    localStorage.setItem('unimed_proposals_history', JSON.stringify(localHistory));

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setHistory(localHistory.slice().reverse().slice(0, 5));
    }

    // 2. Save last used number
    localStorage.setItem('unimed_last_proposal_number', data.proposalNumber);

    // 3. Abrir Modal de Impressão
    setShowPrintModal(true);
  };

  const handleConfirmPrint = () => {
    const originalTitle = document.title;
    const fileName = `Proposta_Unimed_${data.proposalNumber}_${(data.companyName || 'Proposta').replace(/[^a-z0-9]/gi, '_')}`;
    
    document.title = fileName;
    window.print();
    document.title = originalTitle;
    
    // Recarregar a página para limpar tudo (conforme pedido pelo usuário)
    window.location.reload();
  };

  const handleCancelPrint = () => {
    setShowPrintModal(false);
    window.location.reload();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-unimed-green" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-unimed-green p-2 rounded-lg">
              <FileText className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-unimed-green">Gerador de Propostas Unimed</h1>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
            <div className={`w-2 h-2 rounded-full ${profile?.role === 'admin' ? 'bg-red-500' : profile?.role === 'manager' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              {profile?.role === 'admin' ? 'Administrador' : profile?.role === 'manager' ? 'Gerente' : 'Vendedor'}
            </span>
            <span className="text-xs font-medium text-slate-400">|</span>
            <span className="text-xs font-bold text-slate-700">{profile?.full_name}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Printer size={18} />
            Imprimir
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-bold"
          >
            <LogOut size={18} />
            Sair
          </button>
          <button
            onClick={handleGenerateProposal}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-2 bg-unimed-green text-white font-semibold rounded-lg hover:bg-unimed-dark transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? 'Gerando...' : (
              <>
                <FileText size={18} />
                Gerar Proposta
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 flex flex-col xl:flex-row gap-8 items-start">
        {/* Container Lado Esquerdo */}
        <div className="flex flex-col gap-8 w-full xl:w-[702px] shrink-0">
          <div className="flex flex-col md:flex-row gap-8 w-full">
            {/* Coluna 1: Dados e Filtros */}
            <aside className="space-y-6 w-full md:w-[350px] shrink-0">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Info size={20} className="text-[#00995D]" />
              Dados da Proposta
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Nº da Proposta</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input
                    type="text"
                    name="proposalNumber"
                    value={data.proposalNumber}
                    readOnly
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">CNPJ da Empresa</label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${isSearchingCNPJ ? 'text-unimed-green animate-pulse' : 'text-slate-400'}`} size={18} />
                  <input
                    type="text"
                    name="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={data.cnpj}
                    onChange={handleInputChange}
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                  {isSearchingCNPJ && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-unimed-green" />
                    </div>
                  )}
                </div>
                {(data.municipio || data.situacao) && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {data.situacao && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${data.situacao === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {data.situacao}
                      </span>
                    )}
                    {data.municipio && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {data.municipio}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Empresa Contratante</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    name="companyName"
                    placeholder="Ex: ACME Corp"
                    value={data.companyName}
                    onChange={handleInputChange}
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Responsável</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    name="responsible"
                    placeholder="Nome do contato"
                    value={data.responsible}
                    onChange={handleInputChange}
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Consultor / Vendedor</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    name="sellerName"
                    placeholder="Seu nome completo"
                    value={data.sellerName}
                    onChange={handleInputChange}
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Validade (Dias)</label>
                  <input
                    type="number"
                    name="validityDays"
                    value={data.validityDays}
                    onChange={handleInputChange}
                    className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-400 tracking-wider">Desconto (%)</label>
                  <input
                    type="number"
                    name="discount"
                    min="0"
                    max="100"
                    value={data.discount}
                    onChange={handleInputChange}
                    className="w-full mt-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00995D] outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <ShieldCheck size={20} className="text-[#00995D]" />
              Filtro de Planos
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abrangência</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(plans.map(p => p.coverage))).map((coverage, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleFilter('coverage', coverage)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${selectedCoverages.includes(coverage)
                        ? 'bg-unimed-green text-white border-unimed-green shadow-sm'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-unimed-green hover:text-unimed-green'
                        }`}
                    >
                      {coverage}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acomodação</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(plans.map(p => p.accommodation))).map((accommodation, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleFilter('accommodation', accommodation)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${selectedAccommodations.includes(accommodation)
                        ? 'bg-unimed-green text-white border-unimed-green shadow-sm'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-unimed-green hover:text-unimed-green'
                        }`}
                    >
                      {accommodation}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </aside>

        {/* Coluna 2: Quantidades de Vidas */}
        <aside className="space-y-6 w-full md:w-[320px] shrink-0">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Plus size={20} className="text-[#00995D]" />
              Vidas por Faixa Etária
            </h2>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-unimed-green"></div>
              </div>
            ) : (
              <div className="space-y-4 pr-2">
                {Object.keys(quantities).map((label, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(label, -1)}
                        className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-600"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-6 text-center font-bold text-[#00995D]">{quantities[label]}</span>
                      <button
                        onClick={() => updateQuantity(label, 1)}
                        className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-600"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-500">Total de Vidas:</span>
                <span className="font-bold text-slate-800">{calculateTotalLives()}</span>
              </div>
            </div>
          </section>
        </aside>
          </div>

          {/* Histórico ocupando a largura total */}
          {history.length > 0 && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Clock size={20} className="text-[#00995D]" />
                Propostas Recentes
              </h2>
              <div className="flex flex-col gap-4">
                {history.map((prop, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm shadow-sm transition-all hover:border-unimed-green/30">
                    <div className="flex justify-between font-bold text-unimed-green mb-2">
                      <span>Nº {prop.proposalNumber}</span>
                      <span>{prop.date}</span>
                    </div>
                    <p className="text-slate-700 font-semibold break-words leading-tight">{prop.companyName || 'Sem Nome'}</p>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/50">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-500 text-xs break-words" title={prop.sellerName || '---'}>
                          Vend: {prop.sellerName || '---'}
                        </p>
                        {prop.discount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-unimed-green/10 text-unimed-green rounded flex-shrink-0">
                            -{prop.discount}%
                          </span>
                        )}
                      </div>
                      {profile?.role !== 'seller' && prop.seller_id !== user?.id && (
                        <span title="Vendedor diferente">
                          <Shield size={14} className="text-slate-300" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Coluna 3: Document Preview */}
        <div className="relative w-full flex-1">
          <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-4 custom-scrollbar">
            <div className="mb-4 flex items-center justify-between no-print">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pré-visualização do Documento</span>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
            </div>

            <div
              id="proposal-document-container"
              className="space-y-8 pb-20"
            >
              {/* Page 1: Cover */}
              <div className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] flex flex-col">
                <div className="h-[40%] bg-slate-100 relative overflow-hidden">
                  <Image
                    src="/imagens/Capa.jpg"
                    alt="Capa Unimed"
                    fill
                    className="object-cover opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20"></div>
                  <div className="absolute bottom-8 right-8 w-48 h-20">
                    <Image
                      src="/imagens/Logo Unimed.png"
                      alt="Logo Unimed"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="flex-1 p-16 flex flex-col justify-between bg-white">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <h1 className="text-6xl font-black text-unimed-green leading-none tracking-tighter">
                        PROPOSTA<br />COMERCIAL
                      </h1>
                      <div className="h-1.5 w-32 bg-unimed-green rounded-full"></div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-bold text-slate-400">{format(new Date(), 'dd/MM/yyyy')}</p>
                      <p className="text-2xl font-black text-unimed-green">Nº da proposta: {data.proposalNumber}</p>
                    </div>

                    <div className="space-y-6 pt-8">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contratante</span>
                        <span className="text-xl font-bold text-slate-800">{data.companyName || 'NOME DA EMPRESA'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Responsável</span>
                        <span className="text-xl font-bold text-slate-800">{data.responsible || '---'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consultor</span>
                        <span className="text-xl font-bold text-slate-800">{data.sellerName || '---'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Validade da Proposta</span>
                        <span className="text-xl font-bold text-unimed-green">{data.validityDays} dias</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end border-t border-slate-100 pt-8">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-unimed-green" />
                      <span className="text-xs font-bold text-slate-400">Unimed Centro Rondônia</span>
                    </div>
                    <span className="text-xs font-bold text-slate-300">Página 01</span>
                  </div>
                </div>
              </div>

              {/* Page 2: Apresentação */}
              <div className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 relative">
                      <Image
                        src="/imagens/Logo Unimed.png"
                        alt="Logo Unimed"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-unimed-green leading-none">PROPOSTA COMERCIAL</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PLANO DE SAÚDE UNIMED CENTRO RONDÔNIA</p>
                    </div>
                  </div>
                  <div className="w-28 h-10 relative">
                    <Image
                      src="/imagens/ans.jpg"
                      alt="ANS"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase mb-8">A Unimed Brasil</h2>
                </div>

                <div className="space-y-8">
                  <p className="text-slate-600 leading-relaxed mb-12">
                    Somos uma marca que possui identidade sólida, comprometidos com a vida, com as pessoas, com o mundo. Lideramos com propósito, pois temos vocação para aquilo que fazemos. Somos ao todo 20 milhões de beneficiários por todo o Brasil, 117 mil médicos cooperados, gerando 156 mil empregos diretos. Fazemos a diferença em nossa sociedade.
                  </p>

                  <div className="grid grid-cols-[100px_1fr] gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex flex-col items-center">
                      <div className="relative w-full aspect-square">
                        <Image
                          src="/imagens/QR code.png"
                          alt="QR Code Unimed"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold mt-1 text-center leading-tight">Conheça a Unimed</span>
                    </div>

                    <div className="flex items-center gap-12 pl-12 border-l border-slate-200 h-full">
                      <div className="relative w-[120px] aspect-square flex-shrink-0">
                        <Image
                          src="/imagens/Mapa brasil.png"
                          alt="Mapa Unimed Brasil"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-lg text-slate-700 leading-tight">
                          Somos <span className="text-unimed-green font-black">339</span> Cooperativas,
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">117 mil</span> médicos cooperados,
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">20 milhões</span> de beneficiários,
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">+ de 29 mil</span> hospitais, clinicas<br /> e serviços credenciados,
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">166</span> hospitais próprios.
                        </p>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase mt-10 mb-8">A Unimed Centro Rondônia</h2>

                  <div className="pt-6 space-y-6">
                    <p className="text-sm leading-relaxed text-slate-600">
                      Atua em uma área de ação composta por 41 cidades, com foco na constante conquista de novos clientes, oferecendo produtos que agregam segurança, comodidade e garantias.
                    </p>

                    <div className="grid grid-cols-[120px_1fr] gap-6 items-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="relative w-full aspect-square">
                        <Image
                          src="/imagens/mapa ro.png"
                          alt="Mapa de Rondônia - Área de Atuação"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="text-lg text-slate-700 leading-tight">
                          Estamos em <span className="text-unimed-green font-black">41</span> municípios.
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          Somos <span className="text-unimed-green font-black">315</span> médicos cooperados e credenciados.
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">10</span> Serviços Próprios.
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">45 mil</span> de beneficiários na área de atuação.
                        </p>
                        <p className="text-lg text-slate-700 leading-tight">
                          <span className="text-unimed-green font-black">+ de 150</span> hospitais credenciados, laboratórios, clínicas e serviços credenciados.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <span>Unimed Centro Rondônia</span>
                  <span>Página 02</span>
                </div>
              </div>

              {/* Page 3: Diferenciais Unimed */}
              <div className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 relative">
                      <Image
                        src="/imagens/Logo Unimed.png"
                        alt="Logo Unimed"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-unimed-green leading-none">PROPOSTA COMERCIAL</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PLANO DE SAÚDE UNIMED CENTRO RONDÔNIA</p>
                    </div>
                  </div>
                  <div className="w-28 h-10 relative">
                    <Image
                      src="/imagens/ans.jpg"
                      alt="ANS"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase mb-8">Diferenciais Unimed</h2>
                  
                  <div className="space-y-4">
                    <div className="relative w-full aspect-video">
                      <Image
                        src="/imagens/nossos servicos.png"
                        alt="Nossos Serviços"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    
                    <div className="relative w-full aspect-video">
                      <Image
                        src="/imagens/nossa marca.png"
                        alt="Nossa Marca"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <span>Unimed Centro Rondônia</span>
                  <span>Página 03</span>
                </div>
              </div>

              {/* Page 4: Carências e Coparticipação */}
              <div className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 relative">
                      <Image
                        src="/imagens/Logo Unimed.png"
                        alt="Logo Unimed"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-unimed-green leading-none">PROPOSTA COMERCIAL</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PLANO DE SAÚDE UNIMED CENTRO RONDÔNIA</p>
                    </div>
                  </div>
                  <div className="w-28 h-10 relative">
                    <Image
                      src="/imagens/ans.jpg"
                      alt="ANS"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase mb-8">Carências</h2>
                  
                  <div className="grid grid-cols-[1.8fr_2fr] gap-10 items-center mb-10">
                    <div className="relative w-full aspect-square">
                      <Image
                        src="/imagens/assistencia.png"
                        alt="Assistência Unimed"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="space-y-4 text-slate-700">
                      <div>
                        <p className="text-sm font-bold text-unimed-green uppercase mb-1">Urgência:</p>
                        <p className="text-xs leading-relaxed">Atendimentos Resultantes de acidentes pessoais ou de complicações no processo gestacional.</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-unimed-green uppercase mb-1">Emergência:</p>
                        <p className="text-xs leading-relaxed">Atendimentos que implicarem risco imediato de vida ou de lesões irreparáveis para o paciente, caracterizado em declaração do médico assistente.</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-unimed-green uppercase mb-1">DLP - Doenças e Lesões Preexistentes:</p>
                        <p className="text-xs leading-relaxed italic">são aquelas existentes antes da contratação do plano de saúde, e que o beneficiário ou seu responsável saiba ser portador (prazo 720 dias).</p>
                      </div>
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase mb-8">Coparticipação e Franquia</h2>
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-none border border-slate-100 shadow-sm transition-all hover:shadow-md">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-unimed-green text-white">
                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r border-white/20">PROCEDIMENTOS</th>
                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r border-white/20 text-center">COPARTICIPAÇÃO</th>
                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-center">LIMITE PARTICIPATIVO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-700">Consultas Médicas eletivas e urgências</td>
                            <td className="py-3 px-4 text-xs font-black text-unimed-green text-center">50%</td>
                            <td className="py-3 px-4 text-xs font-bold text-slate-500 text-center italic">Não se aplica</td>
                          </tr>
                          <tr className="bg-slate-50/30 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-700">Exames laboratoriais e de imagens</td>
                            <td className="py-3 px-4 text-xs font-black text-unimed-green text-center">30%</td>
                            <td className="py-3 px-4 text-xs font-bold text-slate-500 text-center italic">Não se aplica</td>
                          </tr>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-700">Demais procedimentos Ambulatoriais</td>
                            <td className="py-3 px-4 text-xs font-black text-unimed-green text-center">30%</td>
                            <td className="py-3 px-4 text-xs font-bold text-slate-800 text-center tracking-tighter">R$ 2.200,00 por procedimento</td>
                          </tr>
                          <tr className="bg-slate-50/30 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-700">Procedimentos Quimioterápicos, Radiológicos e Imunobiológicos</td>
                            <td className="py-3 px-4 text-xs font-black text-unimed-green text-center">30%</td>
                            <td className="py-3 px-4 text-xs font-bold text-slate-800 text-center tracking-tighter">R$ 2.200,00 por procedimento</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="overflow-hidden rounded-none border border-slate-100 shadow-sm transition-all hover:shadow-md">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-unimed-green text-white">
                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r border-white/20">PROCEDIMENTOS</th>
                            <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-center">FRANQUIA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-700">Internação clínica, cirúrgica e UTI</td>
                            <td className="py-3 px-4 text-xs font-black text-unimed-green text-center">R$ 595,00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <span>Unimed Centro Rondônia</span>
                  <span>Página 04</span>
                </div>
              </div>

              {/* Page 5+: Pricing Tables */}
              {filteredPlans.map((plan, planIdx) => (
                <div key={planIdx} className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                  <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-16 relative">
                        <Image
                          src="/imagens/Logo Unimed.png"
                          alt="Logo Unimed"
                          fill
                          className="object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex flex-col">
                        <h2 className="text-xl font-black text-unimed-green leading-none">PROPOSTA COMERCIAL</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PLANO DE SAÚDE UNIMED CENTRO RONDÔNIA</p>
                      </div>
                    </div>
                    <div className="w-28 h-10 relative">
                      <Image
                        src="/imagens/ans.jpg"
                        alt="ANS"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-end mb-6">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black text-unimed-green tracking-tighter uppercase">Proposta Plano</h2>
                      <p className="text-sm font-black text-slate-600 uppercase tracking-widest">{plan.type}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-2 gap-6 pb-4 border-b border-slate-200/50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Abrangência</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.coverage}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Segmentação</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.segmentation}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Acomodação</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.accommodation}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Registro ANS</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{formatANS(plan.ans)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-600 uppercase">Fator Moderador</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.moderator}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-unimed-green text-white">
                          <th className="py-2 px-4 text-left text-[10px] font-bold uppercase tracking-wider rounded-tl-xl">Faixa Etária</th>
                          {data.discount > 0 ? (
                            <>
                              <th className="py-2 px-4 text-center text-[10px] font-bold uppercase tracking-wider">Valor Orig.</th>
                              <th className="py-2 px-4 text-center text-[10px] font-bold uppercase tracking-wider">Valor Desc.</th>
                            </>
                          ) : (
                            <th className="py-2 px-4 text-center text-[10px] font-bold uppercase tracking-wider">Valor Unit.</th>
                          )}
                          <th className="py-2 px-4 text-center text-[10px] font-bold uppercase tracking-wider">Qtd. Vidas</th>
                          <th className="py-2 px-4 text-right text-[10px] font-bold uppercase tracking-wider rounded-tr-xl">Investimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {plan.ageGroups.map((group, idx) => {
                          const discountedValue = Math.round(group.value * (1 - (data.discount / 100)));
                          const qty = quantities[group.label] || 0;
                          const investment = discountedValue * qty;

                          return (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                              <td className="py-2 px-4 text-xs font-bold text-slate-700">{group.label}</td>
                              {data.discount > 0 ? (
                                <>
                                  <td className="py-2 px-4 text-center text-xs font-bold text-slate-600">
                                    R$ {group.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-4 text-center text-xs font-bold text-slate-600">
                                    R$ {discountedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </>
                              ) : (
                                <td className="py-2 px-4 text-center text-xs font-bold text-slate-600">
                                  R$ {group.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              )}
                              <td className="py-2 px-4 text-center text-xs font-bold text-unimed-green">
                                {qty}
                              </td>
                              <td className="py-2 px-4 text-right text-xs font-bold text-slate-800">
                                R$ {investment.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className={`mt-4 grid ${data.discount > 0 ? 'grid-cols-4' : 'grid-cols-2'} gap-4`}>
                      {data.discount > 0 && (
                        <>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Total Original</p>
                            <p className="text-lg font-black text-slate-400">
                              R$ {calculateOriginalPlanTotal(plan).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Valor do Desconto</p>
                            <p className="text-lg font-black text-red-500">
                              - R$ {(calculateOriginalPlanTotal(plan) - calculatePlanTotal(plan)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Total Vidas</p>
                        <p className="text-lg font-black text-unimed-green">{calculateTotalLives()}</p>
                      </div>
                      <div className="bg-unimed-green/5 p-3 rounded-xl border border-unimed-green/20">
                        <p className="text-[9px] font-bold text-unimed-green uppercase">Total do Plano</p>
                        <p className="text-lg font-black text-unimed-green">
                          R$ {calculatePlanTotal(plan).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-4">
                    <div className="bg-unimed-green/10 p-2 rounded-lg">
                      <Info className="text-unimed-green" size={18} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-800">Custo de Coparticipação</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Consulta</span>
                          <span className="text-[10px] font-bold text-slate-700">{plan.ageGroups[0].consulta}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Exame</span>
                          <span className="text-[10px] font-bold text-slate-700">{plan.ageGroups[0].exame}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-400 uppercase">Franquia</span>
                          <span className="text-[10px] font-bold text-slate-700">R$ {plan.ageGroups[0].franquia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    <span>Unimed Centro Rondônia</span>
                    <span>Página {planIdx + 5 < 10 ? '0' + (planIdx + 5) : planIdx + 5}</span>
                  </div>
                </div>
              ))}

              {/* Final Page: Social Media */}
              <div className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-16 relative">
                      <Image
                        src="/imagens/Logo Unimed.png"
                        alt="Logo Unimed"
                        fill
                        className="object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-xl font-black text-unimed-green leading-none">PROPOSTA COMERCIAL</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">PLANO DE SAÚDE UNIMED CENTRO RONDÔNIA</p>
                    </div>
                  </div>
                  <div className="w-28 h-10 relative">
                    <Image
                      src="/imagens/ans.jpg"
                      alt="ANS"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="relative w-full h-full">
                    <Image
                      src="/imagens/rede sociais.png"
                      alt="Redes Sociais Unimed"
                      fill
                      className="object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <span>Unimed Centro Rondônia</span>
                  <span>Página {filteredPlans.length + 5 < 10 ? '0' + (filteredPlans.length + 5) : filteredPlans.length + 5}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          header, aside, .no-print { display: none !important; }
          main { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; overflow: visible !important; height: auto !important; }
          main > div { overflow: visible !important; height: auto !important; max-height: none !important; static !important; }
          div[class*="sticky"] { position: static !important; max-height: none !important; overflow: visible !important; width: 100% !important; }
          
          #proposal-document-container { 
            height: auto !important; 
            max-height: none !important; 
            overflow: visible !important; 
            padding-bottom: 0 !important; 
            margin-bottom: 0 !important;
            display: block !important;
          }
          
          .proposal-page { 
            width: 210mm !important; 
            min-height: 297mm !important; 
            margin: 0 !important; 
            padding: 10mm !important; 
            box-shadow: none !important; 
            border-radius: 0 !important;
            border: none !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
          }
          .proposal-page:first-of-type {
            padding: 0 !important;
          }
          .proposal-page:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          /* Ensure backgrounds print */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      {/* Pop-up de Confirmação de Impressão */}
      <AnimatePresence>
        {showPrintModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6 border border-slate-100"
            >
              <div className="w-16 h-16 bg-unimed-green/10 rounded-full flex items-center justify-center mx-auto">
                <Printer className="text-unimed-green" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Deseja imprimir a proposta?</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  A proposta foi salva no banco de dados com sucesso.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelPrint}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Não, apenas limpar
                </button>
                <button
                  onClick={handleConfirmPrint}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-unimed-green hover:bg-[#007c4b] shadow-lg shadow-unimed-green/20 transition-all active:scale-95"
                >
                  Sim, imprimir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
