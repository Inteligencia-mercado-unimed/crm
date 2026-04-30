-- Migration: Create plans table
-- Description: Creates a table to store health plans data previously managed via CSV.

CREATE TABLE IF NOT EXISTS public.plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registro_ans TEXT NOT NULL,
    tipo_plano TEXT NOT NULL,
    abrangencia TEXT NOT NULL,
    acomodacao TEXT NOT NULL,
    segmentacao TEXT NOT NULL,
    fator_moderador TEXT NOT NULL,
    faixa TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL,
    consulta TEXT,
    exame TEXT,
    franquia NUMERIC(10, 2),
    vigencia TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster filtering (Dashboard and Generator)
CREATE INDEX IF NOT EXISTS idx_plans_vigencia ON public.plans(vigencia);
CREATE INDEX IF NOT EXISTS idx_plans_abrangencia ON public.plans(abrangencia);
CREATE INDEX IF NOT EXISTS idx_plans_acomodacao ON public.plans(acomodacao);

-- Enable RLS (Row Level Security)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to authenticated users" 
ON public.plans FOR SELECT 
TO authenticated 
USING (true);

-- Allow full access to admins (if profile has role 'admin')
CREATE POLICY "Allow all access to admins" 
ON public.plans FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_plans_updated_at
    BEFORE UPDATE ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
