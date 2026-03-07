import { z } from 'zod';

export const booleanQueryParam = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized.length === 0) {
      return false;
    }
  }

  return value;
}, z.boolean());
