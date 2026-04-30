const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const filePath = path.join(process.cwd(), 'tabela', 'TABELA DE PRECO - 2026.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error('CSV file not found');
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    delimiter: ';',
  });

  console.log(`Found ${parsed.data.length} rows in CSV. Starting migration...`);

  const plansToInsert = parsed.data.map((row) => {
    // Clean up numeric values
    const valorStr = (row[' VALOR '] || row['VALOR'] || '0').replace('.', '').replace(',', '.');
    const franquiaStr = (row['FRANQUIA'] || '0').replace('.', '').replace(',', '.');

    return {
      registro_ans: row['REGISTRO ANS'],
      tipo_plano: row['TIPO PLANO'],
      abrangencia: row['ABRANGENCIA'],
      acomodacao: row['ACOMODAÇÃO'] || row['ACOMODAǟO'] || row['ACOMODACAO'],
      segmentacao: row['SEGMENTAÇÃO'] || row['SEGMENTAǟO'] || row['SEGMENTACAO'],
      fator_moderador: row['FATOR MODERADOR'],
      faixa: row['FAIXA'],
      valor: parseFloat(valorStr) || 0,
      consulta: row['CONSULTA'],
      exame: row['EXAME'],
      franquia: parseFloat(franquiaStr) || 0,
      vigencia: row['VIGENCIA'] || '2026'
    };
  });

  // Insert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < plansToInsert.length; i += batchSize) {
    const batch = plansToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('plans').insert(batch);
    
    if (error) {
      console.error(`Error inserting batch ${i / batchSize}:`, error);
    } else {
      console.log(`Inserted batch ${i / batchSize + 1}`);
    }
  }

  console.log('Migration complete!');
}

migrate();
