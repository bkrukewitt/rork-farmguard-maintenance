import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

export async function getFarmPasswordFromDb(farmId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (error || !data?.data) return null;
    const rd = data.data as Record<string, unknown>;
    return (rd._joinPassword as string) || null;
  } catch (err) {
    console.error('[SupabaseServer] Error fetching farm password:', err);
    return null;
  }
}

export async function verifyFarmAccess(farmId: string, providedPassword: string | null): Promise<boolean> {
  const storedPassword = await getFarmPasswordFromDb(farmId);

  if (!storedPassword) {
    return true;
  }

  if (!providedPassword) {
    console.log(`[Auth] Farm ${farmId} requires password but none provided`);
    return false;
  }

  return storedPassword === providedPassword;
}
