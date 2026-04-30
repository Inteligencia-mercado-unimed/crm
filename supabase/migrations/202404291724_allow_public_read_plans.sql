-- Migration: Update plans RLS to allow public read
-- Description: Allows anonymous (public) read access to the plans table.

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.plans;

CREATE POLICY "Allow public read access" 
ON public.plans FOR SELECT 
TO public 
USING (true);
