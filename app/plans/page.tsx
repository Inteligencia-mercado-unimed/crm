'use client';
import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Search, 
  Filter, 
  MapPin, 
  ChevronRight, 
  FileText, 
  ChevronDown, 
  AlertCircle,
  Copy,
  Plus,
  Loader2,
  X,
  Shield,
  Trash2,
  Edit2,
  Save
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'motion/react';

interface PlanAgeGroup {
  id: string;
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
  vigencia?: string;
  codigo_solus?: string;
  ageGroups: PlanAgeGroup[];
}

const DEFAULT_AGE_GROUPS = [
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

export default function PlansPage() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVigencia, setSelectedVigencia] = useState<string>('');
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  
  // Modal states
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState({
    targetYear: '',
    percentage: 0,
    manualConsulta: '',
    manualExame: '',
    manualFranquia: 0
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    params: { vigencia: string, abrangencia?: string, acomodacao?: string } | null;
    message: string;
  }>({
    isOpen: false,
    params: null,
    message: ''
  });
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [notice, setNotice] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  const [editingGroup, setEditingGroup] = useState<{ id: string, value: number } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlanData, setNewPlanData] = useState({
    registro_ans: '',
    tipo_plano: 'COLETIVO EMPRESARIAL',
    abrangencia: 'REGIONAL',
    acomodacao: 'ENFERMARIA',
    segmentacao: 'Ambulatorial + Hospitalar com obstetrícia',
    fator_moderador: 'PARTICIPATIVO',
    vigencia: new Date().getFullYear().toString(),
    codigo_solus: '',
    consulta: '50%',
    exame: '30%',
    franquia: 595,
    ageGroups: DEFAULT_AGE_GROUPS.map(label => ({ label, value: 0 }))
  });
  const [editingMetadata, setEditingMetadata] = useState<{
    ans: string;
    codigo_solus: string;
    filters: {
      vigencia: string;
      registro_ans: string;
      abrangencia: string;
      acomodacao: string;
    }
  } | null>(null);

  const showNotice = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotice({ isOpen: true, title, message, type });
  };

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/plans');
      const result = await response.json();
      if (Array.isArray(result)) {
        setPlans(result);
        
        // Pegar a vigência mais recente como padrão se não houver selecionada
        if (!selectedVigencia) {
          const uniqueVigencias = Array.from(new Set(result.map(p => p.vigencia || '2026'))).sort().reverse();
          if (uniqueVigencias.length > 0) {
            setSelectedVigencia(uniqueVigencias[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedAgeGroups([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const vigencias = Array.from(new Set(plans.map(p => p.vigencia || '2026'))).sort().reverse();

  const filteredPlans = selectedVigencia === '' 
    ? plans 
    : plans.filter(p => p.vigencia === selectedVigencia);

  const coverageOrder = ['REGIONAL', 'ESTADUAL', 'NACIONAL'];
  const coverages = Array.from(new Set(filteredPlans.map(p => p.coverage.toUpperCase()))).sort((a, b) => {
    return coverageOrder.indexOf(a) - coverageOrder.indexOf(b);
  });

  const getCoverageColor = (coverage: string) => {
    switch (coverage.toUpperCase()) {
      case 'REGIONAL': return { bg: 'bg-[#4A6741]', border: 'border-[#4A6741]', text: 'text-white', light: 'bg-[#E7F3E1]', sub: 'bg-[#A8C69F]' };
      case 'ESTADUAL': return { bg: 'bg-[#C06F35]', border: 'border-[#C06F35]', text: 'text-white', light: 'bg-[#FFF2E9]', sub: 'bg-[#E6B38E]' };
      case 'NACIONAL': return { bg: 'bg-[#404040]', border: 'border-[#404040]', text: 'text-white', light: 'bg-[#F2F2F2]', sub: 'bg-[#A6A6A6]' };
      default: return { bg: 'bg-slate-700', border: 'border-slate-700', text: 'text-white', light: 'bg-slate-50', sub: 'bg-slate-200' };
    }
  };

  const getSolusCode = (plan: Plan) => {
    return plan.codigo_solus || '---';
  };

  const toggleAgeGroupSelection = (label: string) => {
    const normalized = label.trim().toLowerCase()
      .replace(/^de /, '')
      .replace(/^acima de /, '')
      .replace(/\.$/, '')
      .replace(/^0(\d)/, '$1')
      .replace(/^00/, '0');
      
    setSelectedAgeGroups(prev => 
      prev.includes(normalized) ? prev.filter(l => l !== normalized) : [...prev, normalized]
    );
  };

  const handleDuplicate = async () => {
    if (!duplicateData.targetYear || isDuplicating) return;

    setIsDuplicating(true);
    try {
      const response = await fetch('/api/plans/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceVigencia: selectedVigencia,
          targetVigencia: duplicateData.targetYear,
          percentage: duplicateData.percentage,
          manualConsulta: duplicateData.manualConsulta,
          manualExame: duplicateData.manualExame,
          manualFranquia: duplicateData.manualFranquia
        })
      });

      const result = await response.json();
      if (response.ok) {
        showNotice('Sucesso', result.message, 'success');
        setShowDuplicateModal(false);
        fetchPlans(); // Atualizar lista
      } else {
        showNotice('Erro', result.error, 'error');
      }
    } catch (error) {
      showNotice('Erro', 'Erro ao duplicar tabela', 'error');
    } finally {
      setIsDuplicating(false);
    }
  };

  const requestDelete = (params: { vigencia: string, abrangencia?: string, acomodacao?: string }) => {
    let msg = `Tem certeza que deseja excluir TODOS os planos da vigência ${params.vigencia}? Esta ação não pode ser desfeita.`;
    
    if (params.acomodacao) {
      msg = `Deseja excluir o plano ${params.acomodacao} (${params.abrangencia}) da vigência ${params.vigencia}?`;
    } else if (params.abrangencia) {
      msg = `Deseja excluir TODOS os planos com abrangência ${params.abrangencia} da vigência ${params.vigencia}?`;
    }

    setDeleteConfirmation({
      isOpen: true,
      params,
      message: msg
    });
  };

  const confirmDelete = async () => {
    const { params } = deleteConfirmation;
    if (!params) return;

    try {
      const url = new URL('/api/plans', window.location.origin);
      url.searchParams.append('vigencia', params.vigencia);
      if (params.abrangencia) url.searchParams.append('abrangencia', params.abrangencia);
      if (params.acomodacao) url.searchParams.append('acomodacao', params.acomodacao);

      const response = await fetch(url.toString(), { method: 'DELETE' });
      const result = await response.json();

      if (response.ok) {
        setDeleteConfirmation({ ...deleteConfirmation, isOpen: false });
        showNotice('Sucesso', result.message, 'success');
        fetchPlans();
      } else {
        showNotice('Erro', result.error, 'error');
      }
    } catch (error) {
      showNotice('Erro', 'Erro ao excluir planos', 'error');
    }
  };

  const handleInlineUpdate = async () => {
    if (!editingGroup || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGroup.id,
          valor: editingGroup.value
        })
      });

      if (response.ok) {
        setEditingGroup(null);
        fetchPlans();
      } else {
        const result = await response.json();
        showNotice('Erro', result.error, 'error');
      }
    } catch (error) {
      showNotice('Erro', 'Erro ao atualizar valor', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlanData.registro_ans || isCreating) {
      showNotice('Erro', 'Por favor, preencha o registro ANS', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlanData)
      });

      const result = await response.json();
      if (response.ok) {
        showNotice('Sucesso', result.message, 'success');
        setShowCreateModal(false);
        fetchPlans();
      } else {
        showNotice('Erro', result.error, 'error');
      }
    } catch (error) {
      showNotice('Erro', 'Erro ao criar plano', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateMetadata = async () => {
    if (!editingMetadata || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch('/api/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registro_ans: editingMetadata.ans,
          codigo_solus: editingMetadata.codigo_solus,
          filters: editingMetadata.filters
        })
      });

      if (response.ok) {
        showNotice('Sucesso', 'Dados técnicos atualizados com sucesso', 'success');
        setEditingMetadata(null);
        fetchPlans();
      } else {
        const result = await response.json();
        showNotice('Erro', result.error, 'error');
      }
    } catch (error) {
      showNotice('Erro', 'Erro ao atualizar dados técnicos', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row justify-between items-center no-print gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tabelas de Preço</h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Consulte os valores vigentes da Unimed Centro Rondônia</p>
        </div>

        <div className="flex items-center gap-4">
          {canEdit && (
            <div className="flex items-center gap-3 no-print">
              <button 
                onClick={() => {
                  setCreateStep(1);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 bg-[#00995D] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#007D4C] transition-all shadow-lg shadow-[#00995D]/20"
              >
                <Plus size={16} />
                Nova Tabela
              </button>
              
              <button 
                onClick={() => {
                  const basePlan = filteredPlans[0]?.ageGroups[0];
                  setDuplicateData({ 
                    targetYear: (parseInt(selectedVigencia) + 1).toString(), 
                    percentage: 0,
                    manualConsulta: basePlan?.consulta || '50%',
                    manualExame: basePlan?.exame || '30%',
                    manualFranquia: basePlan?.franquia || 595
                  });
                  setShowDuplicateModal(true);
                }}
                className="flex items-center gap-2 bg-[#00995D]/10 text-[#00995D] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#00995D]/20 transition-all"
              >
                <Copy size={16} />
                Reajustar Tabela
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">Vigência Ativa:</span>
            <select 
              value={selectedVigencia}
              onChange={(e) => setSelectedVigencia(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
            >
              {vigencias.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {canEdit && (
              <button 
                onClick={() => requestDelete({ vigencia: selectedVigencia })}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Excluir toda esta vigência"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação de Plano */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#00995D]/10 rounded-xl flex items-center justify-center text-[#00995D]">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Criar Nova Tabela</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {createStep === 1 ? 'Passo 1: Dados técnicos e coparticipação' : 'Passo 2: Valores por faixa etária'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  <div className={`h-1.5 w-8 rounded-full transition-all ${createStep === 1 ? 'bg-[#00995D]' : 'bg-slate-200'}`} />
                  <div className={`h-1.5 w-8 rounded-full transition-all ${createStep === 2 ? 'bg-[#00995D]' : 'bg-slate-200'}`} />
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {createStep === 1 ? (
                /* Passo 1: Dados Técnicos */
                <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-4 h-px bg-slate-200" /> Dados Técnicos do Plano
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Registro ANS</label>
                        <input 
                          type="text" 
                          value={newPlanData.registro_ans}
                          onChange={e => setNewPlanData({...newPlanData, registro_ans: e.target.value})}
                          placeholder="Ex: 489.123/21-5"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Plano</label>
                        <input 
                          type="text" 
                          value={newPlanData.tipo_plano}
                          onChange={e => setNewPlanData({...newPlanData, tipo_plano: e.target.value})}
                          placeholder="Ex: COLETIVO EMPRESARIAL"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Abrangência</label>
                        <input 
                          type="text" 
                          value={newPlanData.abrangencia}
                          onChange={e => setNewPlanData({...newPlanData, abrangencia: e.target.value.toUpperCase()})}
                          placeholder="Ex: REGIONAL"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Acomodação</label>
                        <select 
                          value={newPlanData.acomodacao}
                          onChange={e => setNewPlanData({...newPlanData, acomodacao: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        >
                          <option value="ENFERMARIA">ENFERMARIA</option>
                          <option value="APARTAMENTO">APARTAMENTO</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Segmentação</label>
                        <input 
                          type="text" 
                          value={newPlanData.segmentacao}
                          onChange={e => setNewPlanData({...newPlanData, segmentacao: e.target.value})}
                          placeholder="Ex: Ambulatorial + Hospitalar com obstetrícia"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fator Moderador</label>
                        <input 
                          type="text" 
                          value={newPlanData.fator_moderador}
                          onChange={e => setNewPlanData({...newPlanData, fator_moderador: e.target.value})}
                          placeholder="Ex: PARTICIPATIVO"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-4 h-px bg-slate-200" /> Vigência e Coparticipação
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Vigência (Ano)</label>
                        <input 
                          type="text" 
                          value={newPlanData.vigencia}
                          onChange={e => setNewPlanData({...newPlanData, vigencia: e.target.value})}
                          placeholder="Ex: 2026"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Código Solus</label>
                        <input 
                          type="text" 
                          value={newPlanData.codigo_solus}
                          onChange={e => setNewPlanData({...newPlanData, codigo_solus: e.target.value})}
                          placeholder="Ex: 060312"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Franquia (R$)</label>
                        <input 
                          type="number" 
                          value={newPlanData.franquia}
                          onChange={e => setNewPlanData({...newPlanData, franquia: parseFloat(e.target.value)})}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Coparticipação Consulta</label>
                        <input 
                          type="text" 
                          value={newPlanData.consulta}
                          onChange={e => setNewPlanData({...newPlanData, consulta: e.target.value})}
                          placeholder="Ex: 50%"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Coparticipação Exame</label>
                        <input 
                          type="text" 
                          value={newPlanData.exame}
                          onChange={e => setNewPlanData({...newPlanData, exame: e.target.value})}
                          placeholder="Ex: 30%"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                /* Passo 2: Valores por Faixa */
                <div className="animate-in slide-in-from-right-4 duration-300">
                  <section className="space-y-6">
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                      <Shield className="text-emerald-500" size={20} />
                      <p className="text-xs text-emerald-700 font-medium">
                        Agora informe os valores mensais para cada faixa etária do plano <strong>{newPlanData.registro_ans}</strong>.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
                      {newPlanData.ageGroups.map((group, idx) => (
                        <div key={group.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 hover:border-[#00995D]/30 transition-all">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.label}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                            <input 
                              type="number" 
                              step="0.01"
                              value={group.value || 0}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setNewPlanData(prev => ({
                                  ...prev,
                                  ageGroups: prev.ageGroups.map((g, i) => 
                                    i === idx ? { ...g, value: val } : g
                                  )
                                }));
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              {createStep === 1 ? (
                <>
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => setCreateStep(2)}
                    disabled={!newPlanData.registro_ans}
                    className="flex-1 bg-[#00995D] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#007D4C] transition-all shadow-lg shadow-[#00995D]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    Próximo Passo
                    <ChevronRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setCreateStep(1)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleCreatePlan}
                    disabled={isCreating}
                    className="flex-1 bg-[#00995D] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#007D4C] transition-all shadow-lg shadow-[#00995D]/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {isCreating ? 'Salvando...' : 'Finalizar e Criar Tabela'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Modal de Edição de Dados Técnicos */}
      {editingMetadata && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#00995D]/10 rounded-xl flex items-center justify-center text-[#00995D]">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Editar Dados Técnicos</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{editingMetadata.filters.acomodacao} - {editingMetadata.filters.abrangencia}</p>
                </div>
              </div>
              <button onClick={() => setEditingMetadata(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Registro ANS</label>
                <input 
                  type="text" 
                  value={editingMetadata.ans}
                  onChange={e => setEditingMetadata({...editingMetadata, ans: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Código Solus</label>
                <input 
                  type="text" 
                  value={editingMetadata.codigo_solus}
                  onChange={e => setEditingMetadata({...editingMetadata, codigo_solus: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setEditingMetadata(null)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpdateMetadata}
                disabled={isUpdating}
                className="flex-1 bg-[#00995D] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#007D4C] transition-all shadow-lg shadow-[#00995D]/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Duplicação */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Duplicar e Reajustar Tabela</h3>
              <button onClick={() => setShowDuplicateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-xs text-amber-700 font-medium leading-relaxed">
                  Isso criará uma cópia completa de todos os planos de <strong>{selectedVigencia}</strong> para o novo ano, aplicando o reajuste informado.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Ano Destino</label>
                  <input 
                    type="text" 
                    value={duplicateData.targetYear}
                    onChange={e => setDuplicateData({...duplicateData, targetYear: e.target.value})}
                    placeholder="Ex: 2027"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Aumento Mensalidades (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      value={duplicateData.percentage}
                      onChange={e => setDuplicateData({...duplicateData, percentage: parseFloat(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Novos Valores de Coparticipação</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Consulta</label>
                      <input 
                        type="text" 
                        value={duplicateData.manualConsulta}
                        onChange={e => setDuplicateData({...duplicateData, manualConsulta: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Exame</label>
                      <input 
                        type="text" 
                        value={duplicateData.manualExame}
                        onChange={e => setDuplicateData({...duplicateData, manualExame: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">Franquia (R$)</label>
                    <input 
                      type="number" 
                      value={duplicateData.manualFranquia}
                      onChange={e => setDuplicateData({...duplicateData, manualFranquia: parseFloat(e.target.value)})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00995D] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDuplicate}
                disabled={isDuplicating || !duplicateData.targetYear}
                className="flex-1 bg-[#00995D] text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#007D4C] transition-all shadow-lg shadow-[#00995D]/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDuplicating ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
                {isDuplicating ? 'Processando...' : 'Confirmar Duplicação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Aviso (Sucesso/Erro) */}
      {notice.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
                notice.type === 'success' ? 'bg-emerald-50 text-emerald-500' : 
                notice.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
              }`}>
                {notice.type === 'success' ? <Check size={32} /> : 
                 notice.type === 'error' ? <AlertCircle size={32} /> : <FileText size={32} />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">{notice.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {notice.message}
              </p>
            </div>
            <div className="p-6 bg-slate-50">
              <button 
                onClick={() => setNotice({ ...notice, isOpen: false })}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-all shadow-lg ${
                  notice.type === 'success' ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' : 
                  notice.type === 'error' ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/20' : 
                  'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-800/20'
                }`}
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
          >
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Confirmar Exclusão</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {deleteConfirmation.message}
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setDeleteConfirmation({ ...deleteConfirmation, isOpen: false })}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-red-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <main className="p-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00995D]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 items-start">
            {coverages.map((coverage) => {
              const color = getCoverageColor(coverage);
              const plansInCoverage = filteredPlans.filter(p => p.coverage.toUpperCase() === coverage);
              const accommodations = ['ENFERMARIA', 'APARTAMENTO'];

              return (
                <section key={coverage} className="space-y-4 bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 p-1">
                  {/* Header da Abrangência */}
                  <div className={`${color.bg} ${color.text} py-3 px-6 rounded-[1.8rem] text-center shadow-md relative group`}>
                    <h2 className="text-xl font-black tracking-[0.2em]">{coverage}</h2>
                    {canEdit && (
                      <button 
                        onClick={() => requestDelete({ vigencia: selectedVigencia, abrangencia: coverage })}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title={`Excluir todos os planos ${coverage}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="px-3 pb-4 space-y-4">
                    <div className="bg-white border border-slate-100 rounded-2xl py-3 text-center shadow-sm">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">{plansInCoverage[0]?.moderator || 'PARTICIPATIVO'}</p>
                      <p className="text-[11px] font-bold text-slate-400 uppercase mt-1.5 leading-relaxed">{plansInCoverage[0]?.segmentation || 'Ambulatorial + Hospitalar com obstetrícia'}</p>
                    </div>

                    <div className={`grid gap-4 ${plansInCoverage.length === 1 ? 'grid-cols-1 max-w-[320px] mx-auto' : 'grid-cols-2'}`}>
                      {accommodations.map((accType) => {
                        const plan = plansInCoverage.find(p => p.accommodation.toUpperCase() === accType);
                        if (!plan) return null;

                        return (
                          <div key={accType} className="flex flex-col">
                            {/* Tipo de Acomodação */}
                            <div className={`${color.sub} py-2 text-center rounded-t-xl relative group`}>
                              <h3 className="font-black text-slate-800 text-xs tracking-widest">{accType}</h3>
                              {canEdit && (
                                <button 
                                  onClick={() => requestDelete({ vigencia: selectedVigencia, abrangencia: coverage, acomodacao: accType })}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                                  title={`Excluir ${accType}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>

                            {/* Info Técnica */}
                            <div className="grid grid-cols-1 text-[11px] border-x border-slate-100 bg-slate-50 relative group/info">
                              {canEdit && (
                                <button 
                                  onClick={() => setEditingMetadata({ 
                                    ans: plan.ans, 
                                    codigo_solus: plan.codigo_solus || '',
                                    filters: {
                                      vigencia: selectedVigencia,
                                      registro_ans: plan.ans,
                                      abrangencia: plan.coverage,
                                      acomodacao: plan.accommodation
                                    }
                                  })}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/info:opacity-100 p-1 text-slate-400 hover:text-[#00995D] transition-all z-10"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              <div className="p-1.5 border-b border-slate-200/50 text-center">
                                <p className="text-slate-400 font-bold uppercase">Registro na ANS: <span className="text-slate-700 font-black">{plan.ans}</span></p>
                              </div>
                              <div className="p-1.5 border-b border-slate-200/50 text-center">
                                <p className="text-slate-400 font-bold uppercase">Cód. Solus: <span className="text-slate-700 font-black">{getSolusCode(plan)}</span></p>
                              </div>
                            </div>

                            <div className="border border-t-0 border-slate-100 rounded-b-xl overflow-hidden">
                              {/* Tabela de Preços */}
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left py-1 px-2 font-black text-slate-400 uppercase whitespace-nowrap">Faixa</th>
                                    <th className="text-right py-1 px-2 font-black text-slate-400 uppercase w-28 whitespace-nowrap">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {plan.ageGroups.map((group, idx) => {
                                    const normalizedGroup = group.label.trim().toLowerCase()
                                      .replace(/^de /, '')
                                      .replace(/^acima de /, '')
                                      .replace(/\.$/, '')
                                      .replace(/^0(\d)/, '$1')
                                      .replace(/^00/, '0');
                                    const isSelected = selectedAgeGroups.includes(normalizedGroup);
                                    const isEditing = editingGroup?.id === group.id;

                                    return (
                                      <tr 
                                        key={idx} 
                                        onClick={(e) => {
                                          if (isEditing) return;
                                          toggleAgeGroupSelection(group.label);
                                        }}
                                        className={`transition-all cursor-pointer border-l-4 group/row ${
                                          isSelected 
                                            ? 'bg-[#00995D]/5 border-[#00995D] shadow-inner' 
                                            : 'hover:bg-slate-50 border-transparent'
                                        }`}
                                      >
                                        <td className="py-1 px-2 font-bold text-slate-600 whitespace-nowrap">
                                          {group.label}
                                        </td>
                                        <td className={`py-1 px-2 text-right font-medium relative whitespace-nowrap ${isSelected ? 'text-[#00995D]' : 'text-slate-900'}`}>
                                          {isEditing ? (
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                              <input 
                                                autoFocus
                                                type="number"
                                                step="0.01"
                                                value={editingGroup.value}
                                                onChange={e => setEditingGroup({...editingGroup, value: parseFloat(e.target.value)})}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') handleInlineUpdate();
                                                  if (e.key === 'Escape') setEditingGroup(null);
                                                }}
                                                className="w-20 bg-white border border-[#00995D] rounded px-1 py-0.5 text-right outline-none focus:ring-2 focus:ring-[#00995D]/20"
                                              />
                                              <button 
                                                onClick={handleInlineUpdate}
                                                className="text-[#00995D] hover:text-[#007D4C] p-0.5"
                                              >
                                                {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                              </button>
                                              <button 
                                                onClick={() => setEditingGroup(null)}
                                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-end group/price">
                                              <span>{formatCurrency(group.value)}</span>
                                              {canEdit && (
                                                <div className="w-0 overflow-hidden group-hover/row:w-5 group-hover/row:ml-1 transition-all flex items-center shrink-0">
                                                  <button 
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingGroup({ id: group.id, value: group.value });
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-[#00995D] transition-all"
                                                  >
                                                    <Edit2 size={12} />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>

                              {/* Coparticipação */}
                              <div className="p-3 bg-slate-50/50 border-t border-slate-100">
                                <div className="bg-slate-200/50 py-0.5 px-2 rounded inline-block mb-3">
                                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Coparticipação</p>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500 font-bold uppercase">Consulta</span>
                                    <span className="font-black text-slate-800">{plan.ageGroups[0]?.consulta || '50%'}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500 font-bold uppercase">Exame</span>
                                    <span className="font-black text-slate-800">{plan.ageGroups[0]?.exame || '30%'}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500 font-bold uppercase">Franquia</span>
                                    <span className="font-black text-slate-800">{formatCurrency(plan.ageGroups[0]?.franquia || 595)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
