import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase Admin não inicializado' }, { status: 500 });
    }

    const mapping = [
      { old: ['00 a 18 anos', '0 a 18 anos', 'De 0 a 18 anos'], new: 'De 0 a 18 anos.' },
      { old: ['19 a 23 anos', '19 a 23 anos.'], new: 'De 19 a 23 anos.' },
      { old: ['24 a 28 anos', '24 a 28 anos.'], new: 'De 24 a 28 anos.' },
      { old: ['29 a 33 anos', '29 a 33 anos.'], new: 'De 29 a 33 anos.' },
      { old: ['34 a 38 anos', '34 a 38 anos.'], new: 'De 34 a 38 anos.' },
      { old: ['39 a 43 anos', '39 a 43 anos.'], new: 'De 39 a 43 anos.' },
      { old: ['44 a 48 anos', '44 a 48 anos.'], new: 'De 44 a 48 anos.' },
      { old: ['49 a 53 anos', '49 a 53 anos.'], new: 'De 49 a 53 anos.' },
      { old: ['54 a 58 anos', '54 a 58 anos.'], new: 'De 54 a 58 anos.' },
      { old: ['59 anos ou mais', '59 anos ou mais.', 'Acima de 59 anos'], new: 'Acima de 59 anos.' }
    ];

    const results = [];

    for (const item of mapping) {
      const { error } = await supabaseAdmin
        .from('plans')
        .update({ faixa: item.new })
        .in('faixa', item.old);
      
      if (error) {
        results.push({ label: item.new, status: 'error', error: error.message });
      } else {
        results.push({ label: item.new, status: 'success' });
      }
    }

    return NextResponse.json({ message: 'Padronização concluída', results });
  } catch (error) {
    console.error('Erro na padronização:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
