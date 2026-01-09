export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toLocaleString()} hrs`;
}

export function getMaintenanceStatus(
  lastServiceHours: number | undefined,
  currentHours: number,
  intervalHours: number | undefined,
  lastServiceDate: string | undefined,
  intervalDays: number | undefined
): 'ok' | 'due' | 'overdue' {
  if (intervalHours && lastServiceHours !== undefined) {
    const hoursSinceService = currentHours - lastServiceHours;
    if (hoursSinceService >= intervalHours * 1.1) return 'overdue';
    if (hoursSinceService >= intervalHours * 0.9) return 'due';
  }

  if (intervalDays && lastServiceDate) {
    const daysSinceService = Math.floor(
      (Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceService >= intervalDays * 1.1) return 'overdue';
    if (daysSinceService >= intervalDays * 0.9) return 'due';
  }

  return 'ok';
}

export function getNextServiceDue(
  lastServiceHours: number | undefined,
  intervalHours: number | undefined,
  lastServiceDate: string | undefined,
  intervalDays: number | undefined
): { type: 'hours' | 'date'; value: number | string } | null {
  if (intervalHours && lastServiceHours !== undefined) {
    return { type: 'hours', value: lastServiceHours + intervalHours };
  }
  
  if (intervalDays && lastServiceDate) {
    const nextDate = new Date(lastServiceDate);
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return { type: 'date', value: nextDate.toISOString() };
  }
  
  return null;
}

export function getEquipmentTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    tractor: 'Tractor',
    combine: 'Wheat',
    truck: 'Truck',
    implement: 'Wrench',
    sprayer: 'Droplets',
    planter: 'Sprout',
    loader: 'Container',
    other: 'Settings',
  };
  return icons[type] || 'Settings';
}
