-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_number TEXT NOT NULL,
  company_name TEXT NOT NULL,
  responsible TEXT,
  seller_name TEXT,
  validity_days INTEGER DEFAULT 20,
  date TEXT NOT NULL,
  total_lives INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anyone to read (for this demo, but usually restricted)
CREATE POLICY "Allow public read access" ON proposals FOR SELECT USING (true);

-- Create a policy that allows anyone to insert
CREATE POLICY "Allow public insert access" ON proposals FOR INSERT WITH CHECK (true);
