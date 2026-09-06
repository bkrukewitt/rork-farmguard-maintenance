/** Caps for demo sandbox and limited (unpaid) trial farms. */
export const TRIAL_LIMITS = {
  MAX_EQUIPMENT: 3,
  MAX_MAINTENANCE_LOGS: 5,
} as const;

export const EQUIPMENT_CAP_ERROR = 'EQUIPMENT_CAP_REACHED';
export const LOG_CAP_ERROR = 'LOG_CAP_REACHED';

export function isCapError(message: string | undefined): boolean {
  return message === EQUIPMENT_CAP_ERROR || message === LOG_CAP_ERROR;
}

export function capErrorMessage(code: string): string {
  if (code === EQUIPMENT_CAP_ERROR) {
    return `Free access includes up to ${TRIAL_LIMITS.MAX_EQUIPMENT} machines. Subscribe for unlimited equipment.`;
  }
  if (code === LOG_CAP_ERROR) {
    return `Free access includes up to ${TRIAL_LIMITS.MAX_MAINTENANCE_LOGS} service logs. Subscribe for unlimited history.`;
  }
  return 'Upgrade to continue.';
}
