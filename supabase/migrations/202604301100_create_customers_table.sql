-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cnpj TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    trade_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    municipio TEXT,
    uf TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Permissões (Acesso apenas para usuários autenticados)
CREATE POLICY "Enable all for authenticated users" ON public.customers
    FOR ALL USING (auth.role() = 'authenticated');
