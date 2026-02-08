-- FarmGuard Equipment Management - Supabase Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  serial_number TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  current_hours NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  warranty_expiry TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance logs table
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  hours_at_service NUMERIC NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  consumables_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  performed_by TEXT NOT NULL,
  performed_by_name TEXT,
  downtime_hours NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Maintenance intervals table
CREATE TABLE IF NOT EXISTS maintenance_intervals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  interval_hours NUMERIC,
  interval_days NUMERIC,
  last_performed_hours NUMERIC,
  last_performed_date TEXT,
  notes TEXT
);

-- Consumables table
CREATE TABLE IF NOT EXISTS consumables (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier TEXT,
  supplier_part_number TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 0,
  compatible_equipment JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service routines table
CREATE TABLE IF NOT EXISTS service_routines (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  equipment_types JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspection routines table
CREATE TABLE IF NOT EXISTS inspection_routines (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  equipment_types JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS equipment_user_id_idx ON equipment(user_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_user_id_idx ON maintenance_logs(user_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_equipment_id_idx ON maintenance_logs(equipment_id);
CREATE INDEX IF NOT EXISTS maintenance_logs_date_idx ON maintenance_logs(date);
CREATE INDEX IF NOT EXISTS maintenance_intervals_user_id_idx ON maintenance_intervals(user_id);
CREATE INDEX IF NOT EXISTS maintenance_intervals_equipment_id_idx ON maintenance_intervals(equipment_id);
CREATE INDEX IF NOT EXISTS consumables_user_id_idx ON consumables(user_id);
CREATE INDEX IF NOT EXISTS service_routines_user_id_idx ON service_routines(user_id);
CREATE INDEX IF NOT EXISTS inspection_routines_user_id_idx ON inspection_routines(user_id);

-- Enable Row Level Security
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_routines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment
CREATE POLICY "Users can view their own equipment" ON equipment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own equipment" ON equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own equipment" ON equipment
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own equipment" ON equipment
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for maintenance_logs
CREATE POLICY "Users can view their own maintenance logs" ON maintenance_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own maintenance logs" ON maintenance_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance logs" ON maintenance_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance logs" ON maintenance_logs
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for maintenance_intervals
CREATE POLICY "Users can view their own maintenance intervals" ON maintenance_intervals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own maintenance intervals" ON maintenance_intervals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance intervals" ON maintenance_intervals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance intervals" ON maintenance_intervals
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for consumables
CREATE POLICY "Users can view their own consumables" ON consumables
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consumables" ON consumables
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consumables" ON consumables
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consumables" ON consumables
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for service_routines
CREATE POLICY "Users can view their own service routines" ON service_routines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own service routines" ON service_routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own service routines" ON service_routines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own service routines" ON service_routines
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for inspection_routines
CREATE POLICY "Users can view their own inspection routines" ON inspection_routines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inspection routines" ON inspection_routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inspection routines" ON inspection_routines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inspection routines" ON inspection_routines
  FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime (optional - for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE equipment;
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE consumables;
