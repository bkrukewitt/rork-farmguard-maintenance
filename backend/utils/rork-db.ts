const DB_ENDPOINT = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
const DB_NAMESPACE = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
const DB_TOKEN = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

function getHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${DB_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function getKeyUrl(key: string): string {
  return `${DB_ENDPOINT}/${DB_NAMESPACE}/${encodeURIComponent(key)}`;
}

export async function getValue<T>(key: string): Promise<T | null> {
  try {
    const url = getKeyUrl(key);
    console.log(`[RorkDB] GET ${key}`);
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[RorkDB] Key not found: ${key}`);
        return null;
      }
      console.error(`[RorkDB] GET failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[RorkDB] GET success: ${key}`);
    return data as T;
  } catch (error) {
    console.error(`[RorkDB] Error getting key ${key}:`, error);
    return null;
  }
}

export async function setValue<T>(key: string, value: T): Promise<boolean> {
  try {
    const url = getKeyUrl(key);
    console.log(`[RorkDB] PUT ${key}`);
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(value),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RorkDB] PUT failed: ${response.status} ${errorText}`);
      return false;
    }

    console.log(`[RorkDB] PUT success: ${key}`);
    return true;
  } catch (error) {
    console.error(`[RorkDB] Error setting key ${key}:`, error);
    return false;
  }
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
    console.log(`[RorkDB] Fetching farm data for: ${farmId}`);
    const row = await getValue<FarmDataRow>(`farm_data:${farmId}`);
    if (!row) {
      console.log(`[RorkDB] No farm data found for: ${farmId}`);
      return null;
    }
    console.log(`[RorkDB] Farm data found for: ${farmId}`);
    return row.data;
  } catch (error) {
    console.error(`[RorkDB] Error fetching farm data:`, error);
    return null;
  }
}

export async function upsertFarmData(farmId: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    console.log(`[RorkDB] Upserting farm data for: ${farmId}`);
    const row: FarmDataRow = {
      farm_id: farmId,
      data,
      updated_at: new Date().toISOString(),
    };
    const success = await setValue(`farm_data:${farmId}`, row);
    if (!success) {
      console.error(`[RorkDB] UPSERT farm_data failed for: ${farmId}`);
      return false;
    }
    console.log(`[RorkDB] Farm data upserted successfully for: ${farmId}`);
    return true;
  } catch (error) {
    console.error(`[RorkDB] Error upserting farm data:`, error);
    return false;
  }
}

export async function getFarmMembers(farmId: string): Promise<FarmMemberRow[]> {
  try {
    const members = await getValue<FarmMemberRow[]>(`farm_members:${farmId}`);
    return members ?? [];
  } catch (error) {
    console.error(`[RorkDB] Error fetching farm members:`, error);
    return [];
  }
}

export async function upsertFarmMember(farmId: string, deviceId: string): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const members = await getFarmMembers(farmId);
    const existingIndex = members.findIndex(m => m.device_id === deviceId);

    if (existingIndex !== -1) {
      members[existingIndex].last_active_at = now;
    } else {
      members.push({
        farm_id: farmId,
        device_id: deviceId,
        joined_at: now,
        last_active_at: now,
      });
    }

    const success = await setValue(`farm_members:${farmId}`, members);
    if (!success) {
      console.error(`[RorkDB] UPSERT farm_member failed for farm: ${farmId}, device: ${deviceId}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[RorkDB] Error upserting farm member:`, error);
    return false;
  }
}

export async function updateMemberActivity(farmId: string, deviceId: string): Promise<boolean> {
  try {
    const members = await getFarmMembers(farmId);
    const memberIndex = members.findIndex(m => m.device_id === deviceId);

    if (memberIndex === -1) {
      console.error(`[RorkDB] Member not found: farm=${farmId}, device=${deviceId}`);
      return false;
    }

    members[memberIndex].last_active_at = new Date().toISOString();
    const success = await setValue(`farm_members:${farmId}`, members);

    if (!success) {
      console.error(`[RorkDB] PATCH farm_member failed for farm: ${farmId}, device: ${deviceId}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[RorkDB] Error updating member activity:`, error);
    return false;
  }
}
