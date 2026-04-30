import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    if (!supabaseAdmin) {
      console.error('Supabase Admin client is not initialized. Check your SUPABASE_SERVICE_ROLE_KEY.');
      return NextResponse.json({ error: 'Erro de configuração no servidor' }, { status: 500 });
    }

    const { data: dbPlans, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .order('vigencia', { ascending: false });

    if (error) {
      console.error('Error fetching plans from Supabase:', error);
      return NextResponse.json({ error: 'Erro ao buscar planos no banco de dados' }, { status: 500 });
    }

    if (!dbPlans || dbPlans.length === 0) {
      return NextResponse.json([]);
    }

    // Group by plan metadata
    const plansMap: Record<string, any> = {};

    dbPlans.forEach((row: any) => {
      const key = `${row.registro_ans}-${row.tipo_plano}-${row.abrangencia}-${row.acomodacao}-${row.segmentacao}-${row.fator_moderador}-${row.vigencia}`;
      
      if (!plansMap[key]) {
        plansMap[key] = {
          ans: row.registro_ans,
          type: row.tipo_plano,
          coverage: row.abrangencia,
          accommodation: row.acomodacao,
          segmentation: row.segmentacao,
          moderator: row.fator_moderador,
          vigencia: row.vigencia,
          codigo_solus: row.codigo_solus,
          ageGroups: [],
        };
      }

      plansMap[key].ageGroups.push({
        id: row.id,
        label: row.faixa,
        value: parseFloat(row.valor),
        consulta: row.consulta,
        exame: row.exame,
        franquia: parseFloat(row.franquia)
      });
    });

    const plans = Object.values(plansMap).map((plan: any) => {
      // Sort ageGroups by the first number found in the label
      plan.ageGroups.sort((a: any, b: any) => {
        const ageA = parseInt(a.label.match(/\d+/) || '0');
        const ageB = parseInt(b.label.match(/\d+/) || '0');
        return ageA - ageB;
      });
      return plan;
    });

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error processing plans:', error);
    return NextResponse.json({ error: 'Erro interno ao processar planos' }, { status: 500 });
  }
}


export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const vigencia = searchParams.get('vigencia');
    const abrangencia = searchParams.get('abrangencia');
    const acomodacao = searchParams.get('acomodacao');

    if (!vigencia) {
      return NextResponse.json({ error: 'Vigência é obrigatória' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não inicializado' }, { status: 500 });
    }

    let query = supabaseAdmin.from('plans').delete().eq('vigencia', vigencia);

    if (abrangencia) {
      query = query.eq('abrangencia', abrangencia);
    }

    if (acomodacao) {
      query = query.eq('acomodacao', acomodacao);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting plans:', error);
      return NextResponse.json({ error: 'Erro ao excluir planos' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Planos excluídos com sucesso' });
  } catch (error) {
    console.error('Error processing delete:', error);
    return NextResponse.json({ error: 'Erro interno ao excluir planos' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ids, valor, consulta, exame, franquia, codigo_solus, registro_ans, filters } = body;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não inicializado' }, { status: 500 });
    }

    // Case 1: Bulk metadata update (by filters)
    if (filters) {
      const updateData: any = {};
      if (codigo_solus !== undefined) updateData.codigo_solus = codigo_solus;
      if (registro_ans !== undefined) updateData.registro_ans = registro_ans;

      const { error } = await supabaseAdmin
        .from('plans')
        .update(updateData)
        .match(filters);

      if (error) {
        console.error('Error in bulk update:', error);
        return NextResponse.json({ error: 'Erro ao atualizar metadados' }, { status: 500 });
      }
      return NextResponse.json({ message: 'Metadados atualizados com sucesso' });
    }

    // Case 2: Individual row or list of IDs update
    if (!id && !ids) {
      return NextResponse.json({ error: 'ID ou Lista de IDs é obrigatório' }, { status: 400 });
    }

    const updateData: any = {};
    if (valor !== undefined) updateData.valor = valor;
    if (consulta !== undefined) updateData.consulta = consulta;
    if (exame !== undefined) updateData.exame = exame;
    if (franquia !== undefined) updateData.franquia = franquia;
    if (codigo_solus !== undefined) updateData.codigo_solus = codigo_solus;
    if (registro_ans !== undefined) updateData.registro_ans = registro_ans;

    let query = supabaseAdmin.from('plans').update(updateData);
    
    if (id) {
      query = query.eq('id', id);
    } else if (ids) {
      query = query.in('id', ids);
    }

    const { error } = await query;

    if (error) {
      console.error('Error updating plan:', error);
      return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Plano atualizado com sucesso' });
  } catch (error) {
    console.error('Error processing patch:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar plano' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      registro_ans, 
      tipo_plano, 
      abrangencia, 
      acomodacao, 
      segmentacao, 
      fator_moderador, 
      vigencia,
      codigo_solus,
      ageGroups 
    } = body;

    if (!registro_ans || !tipo_plano || !abrangencia || !acomodacao || !vigencia || !ageGroups) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não inicializado' }, { status: 500 });
    }

    const plansToInsert = ageGroups.map((group: any) => ({
      registro_ans,
      tipo_plano,
      abrangencia,
      acomodacao,
      segmentacao,
      fator_moderador,
      vigencia,
      codigo_solus,
      faixa: group.label,
      valor: parseFloat(group.value),
      consulta: body.consulta || '50%',
      exame: body.exame || '30%',
      franquia: parseFloat(body.franquia || 595)
    }));

    const { error } = await supabaseAdmin.from('plans').insert(plansToInsert);

    if (error) {
      console.error('Error creating plans:', error);
      return NextResponse.json({ error: 'Erro ao criar novos planos' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Nova tabela de planos criada com sucesso' });
  } catch (error) {
    console.error('Error processing post:', error);
    return NextResponse.json({ error: 'Erro interno ao criar planos' }, { status: 500 });
  }
}
