export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return input;

  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .replace(/&#x?[0-9a-f]+;?/gi, (match) => {
      try {
        const decoded = String.fromCharCode(
          match.startsWith('&#x')
            ? parseInt(match.slice(3), 16)
            : parseInt(match.slice(2), 10)
        );
        if (/[<>"'&]/.test(decoded)) return '';
        return match;
      } catch {
        return match;
      }
    });

  sanitized = sanitized.trim();

  return sanitized;
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}
