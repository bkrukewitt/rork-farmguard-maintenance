const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function getHeaders() {
  return {
    'apikey': SUPABASE_KEY || '',
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export interface FarmDataRow {
  farm_id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface FarmMemberRow {
  id?: number;
  farm_id: string;
  device_id: string;
  joined_at: string;
  last_active_at: string;
}

export async function getFarmData(farmId: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/farm_data?farm_id=eq.${encodeURIComponent(farmId)}&select=data`;
    console.log(`[Supabase] Fetching farm data for: ${farmId}`);
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      console.error(`[Supabase] GET farm_data failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const rows: FarmDataRow[] = await response.json();
    if (rows.length === 0) {
      console.log(`[Supabase] No farm data found for: ${farmId}`);
      return null;
    }

    console.log(`[Supabase] Farm data found for: ${farmId}`);
    return rows[0].data;
  } catch (error) {
    console.error(`[Supabase] Error fetching farm data:`, error);
    return null;
  }
}

export async function upsertFarmData(farmId: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/farm_data`;
    console.log(`[Supabase] Upserting farm data for: ${farmId}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        farm_id: farmId,
        data,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Supabase] UPSERT farm_data failed: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[Supabase] Farm data upserted successfully for: ${farmId}`);
    return true;
  } catch (error) {
    console.error(`[Supabase] Error upserting farm data:`, error);
    return false;
  }
}

export async function getFarmMembers(farmId: string): Promise<FarmMemberRow[]> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/farm_members?farm_id=eq.${encodeURIComponent(farmId)}&select=*`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      console.error(`[Supabase] GET farm_members failed: ${response.status}`);
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error(`[Supabase] Error fetching farm members:`, error);
    return [];
  }
}

export async function upsertFarmMember(farmId: string, deviceId: string): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/farm_members`;
    const now = new Date().toISOString();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        farm_id: farmId,
        device_id: deviceId,
        joined_at: now,
        last_active_at: now,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Supabase] UPSERT farm_member failed: ${response.status} ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Supabase] Error upserting farm member:`, error);
    return false;
  }
}

export async function updateMemberActivity(farmId: string, deviceId: string): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/farm_members?farm_id=eq.${encodeURIComponent(farmId)}&device_id=eq.${encodeURIComponent(deviceId)}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        last_active_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`[Supabase] PATCH farm_member failed: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[Supabase] Error updating member activity:`, error);
    return false;
  }
}
