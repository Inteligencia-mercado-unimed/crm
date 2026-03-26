-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL DEFAULT 'seller' CHECK (role IN ('seller', 'manager', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update proposals table to include seller_id
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Managers/Admins can view all profiles" ON profiles;
CREATE POLICY "Managers/Admins can view all profiles" ON profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Proposals policies (Update existing or create new)
DROP POLICY IF EXISTS "Allow public read access" ON proposals;
DROP POLICY IF EXISTS "Allow public insert access" ON proposals;

DROP POLICY IF EXISTS "Sellers can view their own proposals" ON proposals;
CREATE POLICY "Sellers can view their own proposals" ON proposals FOR SELECT USING (
  auth.uid() = seller_id OR 
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager', 'admin')
  )
);

DROP POLICY IF EXISTS "Sellers can insert their own proposals" ON proposals;
CREATE POLICY "Sellers can insert their own proposals" ON proposals FOR INSERT WITH CHECK (
  auth.uid() = seller_id
);

-- Function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'User ' || new.id), 
    'seller'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, full_name, role)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', email, 'User ' || id), 
  'seller'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
