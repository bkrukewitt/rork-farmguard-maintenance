export type UserRole = 'owner' | 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
  profiles?: Profile;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: 'create' | 'update' | 'delete';
  entity_type: 'equipment' | 'maintenance_log' | 'maintenance_interval' | 'consumable' | 'service_routine' | 'inspection_routine';
  entity_id: string;
  entity_name: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface SyncOperation {
  id: string;
  type: 'upsert' | 'delete';
  table: string;
  data: Record<string, any>;
  timestamp: string;
  retries: number;
}
