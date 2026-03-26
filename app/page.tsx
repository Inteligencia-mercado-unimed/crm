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

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);

  // Sync profile data to proposal data
  useEffect(() => {
    if (profile) {
      setData(prev => ({
        ...prev,
        sellerName: profile.full_name,
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
            setHistory(supabaseHistory.map(p => ({
              ...p,
              proposalNumber: p.proposal_number,
              companyName: p.company_name,
              sellerName: p.seller_name,
              totalLives: p.total_lives,
              totalValue: p.total_value,
              discount: p.discount || 0
            })));
            return;
          }
        } catch (err) {
          console.error('Error fetching from Supabase:', err);
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
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
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
      console.error('Error fetching CNPJ:', error);
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
    
    // 1. Save to history
    const historyData = {
      proposal_number: data.proposalNumber,
      company_name: data.companyName,
      responsible: data.responsible,
      seller_name: data.sellerName,
      seller_id: user?.id,
      validity_days: data.validityDays,
      discount: data.discount,
      date: format(new Date(), 'dd/MM/yyyy'),
      total_lives: calculateTotalLives(),
      total_value: plans.reduce((acc, plan) => acc + calculatePlanTotal(plan), 0)
    };

    // Try Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const { error } = await supabase.from('proposals').insert([historyData]);
        if (error) throw error;
        
        // Refresh history from Supabase
        const { data: freshHistory } = await supabase
          .from('proposals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (freshHistory) {
          setHistory(freshHistory.map(p => ({
            ...p,
            proposalNumber: p.proposal_number,
            companyName: p.company_name,
            sellerName: p.seller_name,
            totalLives: p.total_lives,
            totalValue: p.total_value,
            discount: p.discount || 0
          })));
        }
      } catch (err) {
        console.error('Error saving to Supabase:', err);
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

    try {
      // 3. Generate PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = element.querySelectorAll('.proposal-page');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      
      pdf.save(`Proposta_Unimed_${data.proposalNumber}_${data.companyName || 'Sem_Nome'}.pdf`);

      // 4. Increment for next proposal
      const nextNum = (parseInt(data.proposalNumber) + 1).toString().padStart(4, '0');
      setData(prev => ({ 
        ...prev, 
        proposalNumber: nextNum,
        companyName: '',
        responsible: ''
      }));
      
      // Reset quantities for next proposal
      const resetQuantities: Record<string, number> = {};
      Object.keys(quantities).forEach(key => resetQuantities[key] = 0);
      setQuantities(resetQuantities);

      alert(`Proposta ${newProposal.proposalNumber} gerada e salva com sucesso!`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar a proposta. Verifique o console.');
    } finally {
      setIsGenerating(false);
    }
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

      <main className="max-w-[1400px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Sidebar Form */}
        <aside className="space-y-6">
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
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" 
                    name="sellerName"
                    placeholder="Seu nome completo"
                    value={data.sellerName}
                    readOnly
                    className="w-full mt-1 pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed outline-none"
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
              Vidas por Faixa Etária
            </h2>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-unimed-green"></div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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

          {history.length > 0 && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Clock size={20} className="text-[#00995D]" />
                Propostas Recentes
              </h2>
              <div className="space-y-3">
                {history.map((prop, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex justify-between font-bold text-unimed-green mb-1">
                      <span>Nº {prop.proposalNumber}</span>
                      <span>{prop.date}</span>
                    </div>
                    <p className="text-slate-700 font-semibold truncate">{prop.companyName || 'Sem Nome'}</p>
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-2">
                        <p className="text-slate-400">Vendedor: {prop.sellerName || '---'}</p>
                        {prop.discount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-unimed-green/10 text-unimed-green rounded">
                            -{prop.discount}%
                          </span>
                        )}
                      </div>
                      {profile?.role !== 'seller' && prop.seller_id !== user?.id && (
                        <Shield size={12} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        {/* Document Preview */}
        <div className="relative">
          <div className="sticky top-24">
            <div className="mb-4 flex items-center justify-between">
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
                <div className="h-[45%] bg-slate-100 relative overflow-hidden">
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
                    <div className="w-24 h-12 relative">
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

                <div className="mb-8">
                  <h2 className="text-3xl font-black text-unimed-green tracking-tighter uppercase">Quem somos?</h2>
                </div>

                <div className="space-y-8">
                  <p className="text-slate-600 leading-relaxed">
                    Somos uma marca que possui identidade sólida, comprometidos com a vida, com as pessoas, com o mundo. Lideramos com propósito, pois temos vocação para aquilo que fazemos. Somos ao todo 20 milhões de beneficiários por todo o Brasil, 117 mil médicos cooperados, gerando 156 mil empregos diretos. Fazemos a diferença em nossa sociedade.
                  </p>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-3xl font-black text-unimed-green">339</span>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cooperativas</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-3xl font-black text-unimed-green">117 mil</span>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Médicos Cooperados</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-3xl font-black text-unimed-green">20 milhões</span>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Beneficiários</p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2">
                      <span className="text-3xl font-black text-unimed-green">166</span>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospitais Próprios</p>
                    </div>
                  </div>

                  <div className="pt-8 space-y-4">
                    <h3 className="text-xl font-bold text-unimed-green">A Unimed Centro Rondônia</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">
                      Atua em uma área de ação composta por 41 cidades, com foco na constante conquista de novos clientes, oferecendo produtos que agregam segurança, comodidade e garantias.
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-unimed-green" />
                        <span className="text-xs font-bold text-slate-700">Estamos em 41 municípios</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-unimed-green" />
                        <span className="text-xs font-bold text-slate-700">315 médicos cooperados</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-unimed-green" />
                        <span className="text-xs font-bold text-slate-700">10 Serviços Próprios</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-unimed-green" />
                        <span className="text-xs font-bold text-slate-700">45 mil beneficiários</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <span>Unimed Centro Rondônia</span>
                  <span>Página 02</span>
                </div>
              </div>

              {/* Page 3+: Pricing Tables */}
              {plans.map((plan, planIdx) => (
                <div key={planIdx} className="proposal-page bg-white shadow-2xl rounded-sm overflow-hidden mx-auto w-full max-w-[800px] aspect-[1/1.414] p-16 flex flex-col">
                  <div className="flex justify-between items-center mb-10 border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-12 relative">
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
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{plan.type}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Abrangência</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.coverage}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Acomodação</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.accommodation}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Segmentação</span>
                        <span className="text-xs font-bold text-slate-800 uppercase">{plan.segmentation}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Fator Moderador</span>
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
                    <span>Página {planIdx + 3}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @media print {
          header, aside { display: none !important; }
          main { display: block !important; padding: 0 !important; }
          #proposal-document { box-shadow: none !important; transform: none !important; width: 100% !important; max-width: none !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
}
