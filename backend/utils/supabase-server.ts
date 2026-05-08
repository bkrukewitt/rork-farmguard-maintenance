import { createClient } from '@supabase/supabase-js';
import { createHash, randomInt } from 'crypto';

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

export interface PasswordProtectedFarm {
  farmId: string;
  updatedAt: string | null;
}

export async function listPasswordProtectedFarmsFromDb(): Promise<PasswordProtectedFarm[]> {
  try {
    const { data, error } = await supabaseServer
      .from('farm_data')
      .select('farm_id, updated_at, data')
      .order('updated_at', { ascending: false });

    if (error || !data) {
      console.error('[SupabaseServer] Error listing password-protected farms:', error);
      return [];
    }

    return data
      .filter((row) => {
        const rowData = (row.data ?? {}) as Record<string, unknown>;
        const joinPassword = rowData._joinPassword;
        return typeof joinPassword === 'string' && joinPassword.trim().length > 0;
      })
      .map((row) => ({
        farmId: row.farm_id as string,
        updatedAt: (row.updated_at as string | null) ?? null,
      }));
  } catch (err) {
    console.error('[SupabaseServer] Error listing password-protected farms:', err);
    return [];
  }
}

export async function setFarmPasswordInDb(farmId: string, password: string): Promise<boolean> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm before password update:', fetchError);
      return false;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});
    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      return false;
    }

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _joinPassword: trimmedPassword,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error updating farm password:', upsertError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[SupabaseServer] Error updating farm password:', err);
    return false;
  }
}

function hashResetCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export interface FarmPasswordResetRequestResult {
  recoveryEmail: string;
  code: string;
  expiresAt: string;
}

export type CompleteFarmPasswordResetResult =
  | { success: true }
  | { success: false; reason: "missing_reset_request" | "expired" | "locked" | "invalid_code" | "invalid_input" | "server_error"; lockedUntil?: string | null };

export async function requestFarmPasswordResetInDb(farmId: string): Promise<FarmPasswordResetRequestResult | null> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError) {
      console.error('[SupabaseServer] Error fetching farm for password reset request:', fetchError);
      return null;
    }

    const existingData = ((existing?.data as Record<string, unknown> | null) ?? {});
    const recoveryEmail = (existingData._recoveryEmail as string | undefined)?.trim().toLowerCase() ?? '';
    if (!recoveryEmail) {
      return null;
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + (15 * 60 * 1000)).toISOString();

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _passwordResetCodeHash: hashResetCode(code),
          _passwordResetExpiresAt: expiresAt,
          _passwordResetRequestedAt: new Date().toISOString(),
          _passwordResetAttempts: 0,
          _passwordResetLockedUntil: null,
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error storing password reset request:', upsertError);
      return null;
    }

    return { recoveryEmail, code, expiresAt };
  } catch (err) {
    console.error('[SupabaseServer] Error requesting password reset:', err);
    return null;
  }
}

export async function completeFarmPasswordResetInDb(farmId: string, code: string, newPassword: string): Promise<CompleteFarmPasswordResetResult> {
  try {
    const { data: existing, error: fetchError } = await supabaseServer
      .from('farm_data')
      .select('data')
      .eq('farm_id', farmId)
      .maybeSingle();

    if (fetchError || !existing?.data) {
      console.error('[SupabaseServer] Error fetching farm for password reset completion:', fetchError);
      return { success: false, reason: "server_error" };
    }

    const existingData = (existing.data as Record<string, unknown>);
    const storedHash = (existingData._passwordResetCodeHash as string | undefined) ?? '';
    const expiresAt = (existingData._passwordResetExpiresAt as string | undefined) ?? '';
    const currentAttempts = Number(existingData._passwordResetAttempts ?? 0) || 0;
    const lockedUntil = (existingData._passwordResetLockedUntil as string | undefined) ?? null;
    const trimmedCode = code.trim();
    const trimmedPassword = newPassword.trim();
    const now = Date.now();
    const lockoutDurationMs = 15 * 60 * 1000;
    const maxAttempts = 5;

    if (!storedHash || !expiresAt || !trimmedCode || !trimmedPassword) {
      return { success: false, reason: "missing_reset_request" };
    }
    if (trimmedPassword.length < 4) {
      return { success: false, reason: "invalid_input" };
    }
    if (lockedUntil && new Date(lockedUntil).getTime() > now) {
      return { success: false, reason: "locked", lockedUntil };
    }
    if (new Date(expiresAt).getTime() < now) {
      return { success: false, reason: "expired" };
    }
    if (hashResetCode(trimmedCode) !== storedHash) {
      const nextAttempts = currentAttempts + 1;
      const newLockedUntil = nextAttempts >= maxAttempts ? new Date(now + lockoutDurationMs).toISOString() : null;
      const { error: attemptError } = await supabaseServer
        .from('farm_data')
        .upsert({
          farm_id: farmId,
          data: {
            ...existingData,
            _passwordResetAttempts: nextAttempts,
            _passwordResetLockedUntil: newLockedUntil,
          },
          updated_at: new Date().toISOString(),
        });
      if (attemptError) {
        console.error('[SupabaseServer] Error updating reset attempts:', attemptError);
        return { success: false, reason: "server_error" };
      }
      if (newLockedUntil) {
        return { success: false, reason: "locked", lockedUntil: newLockedUntil };
      }
      return { success: false, reason: "invalid_code" };
    }

    const { error: upsertError } = await supabaseServer
      .from('farm_data')
      .upsert({
        farm_id: farmId,
        data: {
          ...existingData,
          _joinPassword: trimmedPassword,
          _passwordResetCodeHash: null,
          _passwordResetExpiresAt: null,
          _passwordResetRequestedAt: null,
          _passwordResetAttempts: 0,
          _passwordResetLockedUntil: null,
          _passwordResetCompletedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      });

    if (upsertError) {
      console.error('[SupabaseServer] Error completing password reset:', upsertError);
      return { success: false, reason: "server_error" };
    }

    return { success: true };
  } catch (err) {
    console.error('[SupabaseServer] Error completing password reset:', err);
    return { success: false, reason: "server_error" };
  }
}
