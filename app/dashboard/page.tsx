'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  FileText, Users, DollarSign, FileCheck, TrendingUp, PieChart as PieChartIcon
} from 'lucide-react';

const COLORS = ['#00995D', '#007A4A', '#33AD7D', '#66C29D', '#99D6BE'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProposals = async () => {
    if (!user) return;
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const { data, error } = await supabase
          .from('proposals')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          setProposals(data);
        }
      } else {
        const localHistory = JSON.parse(localStorage.getItem('unimed_proposals_history') || '[]');
        setProposals(localHistory);
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

  // --- Processar dados para gráficos ---
  const proposalsBySellerMap = new Map();
  const uniqueProposals = new Set();
  const uniqueProposalsList: any[] = [];
  
  proposals.forEach((p: any) => {
    const proposalId = p.proposal_number || p.proposalNumber;
    if (!uniqueProposals.has(proposalId)) {
      uniqueProposals.add(proposalId);
      uniqueProposalsList.push(p);
      
      const seller = p.seller_name || p.sellerName || 'Desconhecido';
      if (!proposalsBySellerMap.has(seller)) {
        proposalsBySellerMap.set(seller, { name: seller, propostas: 0, valor: 0, vidas: 0 });
      }
      
      const current = proposalsBySellerMap.get(seller);
      current.propostas += 1;
      current.valor += Number(p.total_value || p.totalValue || 0);
      current.vidas += Number(p.total_lives || p.totalLives || 0);
    }
  });

  const chartDataSellers = Array.from(proposalsBySellerMap.values());

  const ageGroupMap = new Map();
  proposals.forEach((p: any) => {
    if (p.age_group && p.lives_count) {
      const age = p.age_group;
      ageGroupMap.set(age, (ageGroupMap.get(age) || 0) + Number(p.lives_count));
    }
  });
  
  if (ageGroupMap.size === 0 && proposals.length > 0) {
    proposals.forEach((p: any) => {
      if (p.quantities) {
        Object.entries(p.quantities).forEach(([age, count]) => {
          if (Number(count) > 0) {
             ageGroupMap.set(age, (ageGroupMap.get(age) || 0) + Number(count));
          }
        });
      }
    });
  }

  const chartDataAgeGroups = Array.from(ageGroupMap.entries()).map(([name, value]) => ({ name, value }));

  const totalProposalsCount = uniqueProposals.size;
  const totalLivesCount = chartDataSellers.reduce((acc, curr) => acc + curr.vidas, 0);
  const totalValueSum = chartDataSellers.reduce((acc, curr) => acc + curr.valor, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Bar do Dashboard */}
      <div className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center no-print sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard & Relatórios</h1>
          <p className="text-sm text-slate-400 font-medium mt-1">Bem-vindo ao painel de controle da Unimed Centro Rondônia</p>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-8 space-y-8">
        
        {/* Visão Geral (Overview) */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 mb-6 uppercase tracking-wider">Visão Geral</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-blue-50 p-4 rounded-xl text-blue-600">
                <FileCheck size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total de Propostas</p>
                <p className="text-3xl font-black text-slate-800">{totalProposalsCount}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-green-50 p-4 rounded-xl text-green-600">
                <Users size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total de Vidas</p>
                <p className="text-3xl font-black text-slate-800">{totalLivesCount}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="bg-amber-50 p-4 rounded-xl text-amber-600">
                <DollarSign size={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor Total (R$)</p>
                <p className="text-2xl font-black text-slate-800">{formatCurrency(totalValueSum)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#00995D]" />
              Propostas por Vendedor
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataSellers} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#F1F5F9'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend wrapperStyle={{paddingTop: '20px'}} />
                  <Bar dataKey="propostas" name="Nº de Propostas" fill="#00995D" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <PieChartIcon size={20} className="text-[#00995D]" />
              Distribuição por Faixa Etária
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartDataAgeGroups}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                  >
                    {chartDataAgeGroups.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
        
        {/* Histórico Completo */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <FileText size={20} className="text-[#00995D]" />
            Resumo do Histórico
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-widest border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 rounded-tl-xl">Número</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">Vendedor</th>
                  <th className="px-6 py-4 rounded-tr-xl text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniqueProposalsList.slice(0, 10).map((prop, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-[#00995D]">
                      #{prop.proposalNumber || prop.proposal_number}
                    </td>
                    <td className="px-6 py-4">{prop.date || new Date(prop.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 font-bold text-slate-800">{prop.companyName || prop.company_name || 'Sem Nome'}</td>
                    <td className="px-6 py-4">{prop.sellerName || prop.seller_name || '---'}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(prop.totalValue || prop.total_value || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
