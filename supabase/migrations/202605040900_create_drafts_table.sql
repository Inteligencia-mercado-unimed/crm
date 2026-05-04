-- Criar tabela de rascunhos
CREATE TABLE IF NOT EXISTS public.drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    selected_coverages TEXT[] DEFAULT '{}',
    selected_accommodations TEXT[] DEFAULT '{}',
    quantities JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para busca por usuário
CREATE INDEX IF NOT EXISTS drafts_user_id_idx ON public.drafts(user_id);

-- Habilitar RLS
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;

-- Cada usuário só vê e gerencia seus próprios rascunhos
CREATE POLICY "Users can manage their own drafts" ON public.drafts
    FOR ALL USING (auth.uid() = user_id);
