import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'tabela', 'TABELA DE PRECO - 2026.csv');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Parse CSV with semicolon separator
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      delimiter: ';',
    });

    // Group by plan metadata
    const plansMap: Record<string, any> = {};

    parsed.data.forEach((row: any) => {
      const key = `${row['REGISTRO ANS']}-${row['TIPO PLANO']}-${row['ABRANGENCIA']}-${row['ACOMODAÇÃO']}-${row['SEGMENTAÇÃO']}-${row['FATOR MODERADOR']}`;
      
      if (!plansMap[key]) {
        plansMap[key] = {
          ans: row['REGISTRO ANS'],
          type: row['TIPO PLANO'],
          coverage: row['ABRANGENCIA'],
          accommodation: row['ACOMODAÇÃO'],
          segmentation: row['SEGMENTAÇÃO'],
          moderator: row['FATOR MODERADOR'],
          ageGroups: [],
        };
      }

      // Clean up values
      const valueStr = row[' VALOR ']?.replace('.', '').replace(',', '.') || '0';
      const value = parseFloat(valueStr);
      
      const consulta = row['CONSULTA'];
      const exame = row['EXAME'];
      const franquiaStr = row['FRANQUIA']?.replace('.', '').replace(',', '.') || '0';
      const franquia = parseFloat(franquiaStr);

      plansMap[key].ageGroups.push({
        label: row['FAIXA'],
        value: value,
        consulta,
        exame,
        franquia
      });
    });

    const plans = Object.values(plansMap);

    return NextResponse.json(plans);
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json({ error: 'Erro ao ler o arquivo' }, { status: 500 });
  }
}
