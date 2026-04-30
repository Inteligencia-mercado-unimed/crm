import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const { sourceVigencia, targetVigencia, percentage, manualConsulta, manualExame, manualFranquia } = await request.json();

    if (!sourceVigencia || !targetVigencia || percentage === undefined) {
      return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não inicializado' }, { status: 500 });
    }

    // 1. Buscar todos os planos da vigência de origem
    const { data: sourcePlans, error: fetchError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('vigencia', sourceVigencia);

    if (fetchError) {
      return NextResponse.json({ error: 'Erro ao buscar planos de origem' }, { status: 500 });
    }

    if (!sourcePlans || sourcePlans.length === 0) {
      return NextResponse.json({ error: 'Nenhum plano encontrado para a vigência de origem' }, { status: 404 });
    }

    // 2. Preparar os novos planos com o aumento
    const multiplier = 1 + (percentage / 100);
    const newPlans = sourcePlans.map(plan => {
      // Remover ID e timestamps para o Supabase gerar novos
      const { id, created_at, updated_at, ...planData } = plan;
      
      return {
        ...planData,
        vigencia: targetVigencia,
        valor: parseFloat((plan.valor * multiplier).toFixed(2)),
        consulta: manualConsulta !== undefined ? manualConsulta : plan.consulta,
        exame: manualExame !== undefined ? manualExame : plan.exame,
        franquia: manualFranquia !== undefined ? parseFloat(manualFranquia) : plan.franquia
      };
    });

    // 3. Inserir os novos planos
    // Inserir em lotes para evitar timeout
    const batchSize = 500;
    for (let i = 0; i < newPlans.length; i += batchSize) {
      const batch = newPlans.slice(i, i + batchSize);
      const { error: insertError } = await supabaseAdmin.from('plans').insert(batch);
      
      if (insertError) {
        console.error(`Erro ao inserir lote ${i}:`, insertError);
        return NextResponse.json({ error: 'Erro ao inserir novos planos' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: `Tabela ${targetVigencia} criada com sucesso com ${percentage}% de aumento.` });

  } catch (error) {
    console.error('Erro na duplicação:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
