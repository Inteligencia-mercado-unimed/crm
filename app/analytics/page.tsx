'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Users, DollarSign,
  FileText, Award, Calendar, Target, Activity, Minus
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#00995D', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

type Period = '30d' | '90d' | '180d' | '1y' | 'all';

function KpiCard({ title, value, sub, icon: Icon, color, trend, trendValue }: any) {
  const isUp = trend === 'up';
  const isDown = trend === 'down';
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center`} style={{ background: color + '18' }}>
          <Icon size={22} style={{ color }} />
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isUp ? 'bg-green-50 text-green-600' : isDown ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
            {isUp ? <TrendingUp size={12} /> : isDown ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trendValue}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 font-medium mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 min-w-[140px]">
        <p className="text-xs font-black text-slate-400 uppercase mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [allProposals, setAllProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('90d');

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('proposals').select('*').order('created_at', { ascending: true });
      if (!error && data) setAllProposals(data);
      setIsLoading(false);
    };
    fetch();
  }, [user]);

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === '30d') return subDays(now, 30);
    if (period === '90d') return subDays(now, 90);
    if (period === '180d') return subDays(now, 180);
    if (period === '1y') return subDays(now, 365);
    return new Date('2000-01-01');
  }, [period]);

  const prevPeriodStart = useMemo(() => {
    const now = new Date();
    if (period === '30d') return subDays(now, 60);
    if (period === '90d') return subDays(now, 180);
    if (period === '180d') return subDays(now, 360);
    if (period === '1y') return subDays(now, 730);
    return new Date('2000-01-01');
  }, [period]);

  // Deduplicate by proposal_number
  const deduped = useMemo(() => {
    const seen = new Set();
    return allProposals.filter(p => {
      const id = p.proposal_number || p.proposalNumber;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [allProposals]);

  const filtered = useMemo(() =>
    deduped.filter(p => new Date(p.created_at) >= periodStart),
    [deduped, periodStart]
  );

  const prevFiltered = useMemo(() =>
    deduped.filter(p => new Date(p.created_at) >= prevPeriodStart && new Date(p.created_at) < periodStart),
    [deduped, prevPeriodStart, periodStart]
  );

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalValue = useMemo(() => filtered.reduce((a, p) => a + Number(p.total_value || 0), 0), [filtered]);
  const totalLives = useMemo(() => filtered.reduce((a, p) => a + Number(p.total_lives || 0), 0), [filtered]);
  const avgTicket = filtered.length > 0 ? totalValue / filtered.length : 0;
  const avgValuePerLife = totalLives > 0 ? totalValue / totalLives : 0;

  const prevTotalValue = useMemo(() => prevFiltered.reduce((a, p) => a + Number(p.total_value || 0), 0), [prevFiltered]);
  const prevCount = prevFiltered.length;

  const trendCount = prevCount === 0 ? null : ((filtered.length - prevCount) / prevCount * 100).toFixed(0) + '%';
  const trendValue = prevTotalValue === 0 ? null : ((totalValue - prevTotalValue) / prevTotalValue * 100).toFixed(0) + '%';

  // Monthly evolution
  const monthlyData = useMemo(() => {
    const map = new Map<string, { label: string; propostas: number; valor: number; vidas: number }>();
    const months = period === '30d' ? 2 : period === '90d' ? 3 : period === '180d' ? 6 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      map.set(key, { label: format(d, 'MMM/yy', { locale: ptBR }), propostas: 0, valor: 0, vidas: 0 });
    }
    deduped.forEach(p => {
      const key = format(new Date(p.created_at), 'yyyy-MM');
      if (map.has(key)) {
        const curr = map.get(key)!;
        curr.propostas++;
        curr.valor += Number(p.total_value || 0);
        curr.vidas += Number(p.total_lives || 0);
      }
    });
    return Array.from(map.values());
  }, [deduped, period]);

  // Seller ranking
  const sellerRanking = useMemo(() => {
    const map = new Map<string, { name: string; propostas: number; valor: number; vidas: number }>();
    filtered.forEach(p => {
      const s = p.seller_name || p.sellerName || 'Desconhecido';
      if (!map.has(s)) map.set(s, { name: s, propostas: 0, valor: 0, vidas: 0 });
      const c = map.get(s)!;
      c.propostas++;
      c.valor += Number(p.total_value || 0);
      c.vidas += Number(p.total_lives || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  // Coverage distribution
  const coverageData = useMemo(() => {
    const map = new Map<string, number>();
    allProposals.forEach(p => {
      const k = p.coverage || 'N/A';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [allProposals]);

  // Accommodation distribution
  const accomData = useMemo(() => {
    const map = new Map<string, number>();
    allProposals.forEach(p => {
      const k = p.accommodation || 'N/A';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [allProposals]);

  // Age group distribution
  const ageData = useMemo(() => {
    const map = new Map<string, number>();
    allProposals.forEach(p => {
      if (p.age_group && p.lives_count) {
        map.set(p.age_group, (map.get(p.age_group) || 0) + Number(p.lives_count));
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.replace('De ', '').replace('.', ''), value }))
      .sort((a, b) => {
        const numA = parseInt(a.name);
        const numB = parseInt(b.name);
        return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB);
      });
  }, [allProposals]);

  const periods: { id: Period; label: string }[] = [
    { id: '30d', label: '30 dias' },
    { id: '90d', label: '90 dias' },
    { id: '180d', label: '6 meses' },
    { id: '1y', label: '1 ano' },
    { id: 'all', label: 'Tudo' },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-[#00995D] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-bold text-sm">Carregando Analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-500/10 rounded-2xl flex items-center justify-center text-violet-600">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Analytics</h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Análise estratégica de performance comercial</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                period === p.id
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            title="Propostas Emitidas"
            value={filtered.length}
            sub={`${prevCount} no período anterior`}
            icon={FileText}
            color="#00995D"
            trend={filtered.length > prevCount ? 'up' : filtered.length < prevCount ? 'down' : 'flat'}
            trendValue={trendCount ?? '—'}
          />
          <KpiCard
            title="Volume Total"
            value={formatCurrency(totalValue)}
            sub={`Anterior: ${formatCurrency(prevTotalValue)}`}
            icon={DollarSign}
            color="#3B82F6"
            trend={totalValue > prevTotalValue ? 'up' : totalValue < prevTotalValue ? 'down' : 'flat'}
            trendValue={trendValue ?? '—'}
          />
          <KpiCard
            title="Total de Vidas"
            value={totalLives}
            sub={`Média: ${filtered.length > 0 ? (totalLives / filtered.length).toFixed(1) : 0} vidas/proposta`}
            icon={Users}
            color="#8B5CF6"
            trend={null}
          />
          <KpiCard
            title="Ticket Médio"
            value={formatCurrency(avgTicket)}
            sub={`${formatCurrency(avgValuePerLife)} / vida`}
            icon={Target}
            color="#F59E0B"
            trend={null}
          />
        </div>

        {/* Monthly Evolution */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
            <Activity size={18} className="text-[#00995D]" />
            Evolução de Propostas e Volume
          </h2>
          <p className="text-xs text-slate-400 font-medium mb-6">Número de propostas e valor total por mês</p>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradPropostas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00995D" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00995D" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12, fontWeight: 700 }} />
                <Area yAxisId="left" type="monotone" dataKey="propostas" name="Propostas" stroke="#00995D" strokeWidth={2.5} fill="url(#gradPropostas)" dot={{ r: 4, fill: '#00995D' }} activeDot={{ r: 6 }} />
                <Area yAxisId="right" type="monotone" dataKey="valor" name="Volume (R$)" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gradValor)" dot={{ r: 4, fill: '#3B82F6' }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seller Ranking + Coverage */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Seller Ranking */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
              <Award size={18} className="text-amber-500" />
              Ranking de Vendedores
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-6">Ordenado por volume total no período</p>
            {sellerRanking.length === 0 ? (
              <p className="text-slate-400 text-sm font-medium text-center py-8">Sem dados no período selecionado.</p>
            ) : (
              <div className="space-y-3">
                {sellerRanking.map((s, i) => {
                  const maxVal = sellerRanking[0]?.valor || 1;
                  const pct = (s.valor / maxVal) * 100;
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={s.name} className="flex items-center gap-4">
                      <span className="text-xl w-8 text-center">{medals[i] || `#${i + 1}`}</span>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-bold text-slate-800">{s.name}</span>
                          <div className="flex items-center gap-4 text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase">{s.propostas} prop. · {s.vidas} vidas</span>
                            <span className="text-sm font-black text-slate-900 min-w-[100px] text-right">{formatCurrency(s.valor)}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Coverage Pie */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-500" />
              Abrangência
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-4">Regional vs Estadual</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={coverageData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                    {coverageData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {coverageData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs font-bold text-slate-600">{d.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Age + Accommodation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Age Group Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              Vidas por Faixa Etária
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-6">Total de vidas em todas as propostas</p>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Vidas" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={28}>
                    {ageData.map((_, idx) => (
                      <Cell key={idx} fill={`hsl(${217 + idx * 5}, 80%, ${55 + idx * 2}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accommodation + Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-base font-black text-slate-800 mb-1 flex items-center gap-2">
              <Calendar size={18} className="text-[#00995D]" />
              Acomodação & Estatísticas
            </h2>
            <p className="text-xs text-slate-400 font-medium mb-6">Distribuição e métricas gerais</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {accomData.map((d, i) => (
                <div key={d.name} className="rounded-xl p-4 border border-slate-100 bg-slate-50/50 text-center">
                  <p className="text-2xl font-black" style={{ color: COLORS[i % COLORS.length] }}>{d.value}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{d.name}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {[
                { label: 'Vendedores ativos', value: sellerRanking.length },
                { label: 'Média de vidas/proposta', value: filtered.length > 0 ? (totalLives / filtered.length).toFixed(1) : '—' },
                { label: 'Valor médio/vida', value: formatCurrency(avgValuePerLife) },
                { label: 'Proposta de maior valor', value: formatCurrency(Math.max(...filtered.map(p => Number(p.total_value || 0)), 0)) },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center border-b border-slate-50 pb-3">
                  <span className="text-xs font-bold text-slate-500">{stat.label}</span>
                  <span className="text-sm font-black text-slate-800">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
