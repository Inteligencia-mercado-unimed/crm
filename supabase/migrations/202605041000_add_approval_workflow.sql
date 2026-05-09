-- Adicionar campos de aprovação na tabela de propostas
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
ADD COLUMN IF NOT EXISTS requested_discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Atualizar propostas existentes para 'approved' para não quebrar o histórico
UPDATE public.proposals SET status = 'approved' WHERE status IS NULL;

-- Política de segurança: Vendedores podem ver suas propostas, Gerentes/Adms veem todas
DROP POLICY IF EXISTS "Allow public read access" ON public.proposals;
CREATE POLICY "Users can see their own proposals or all if manager/admin" 
ON public.proposals 
FOR SELECT 
USING (
  auth.uid() = seller_id OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND (role = 'manager' OR role = 'admin')
  )
);
