-- Migration: Add codigo_solus to plans table
-- Description: Adds a column to store the Solus business identifier for each plan.

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS codigo_solus TEXT;
