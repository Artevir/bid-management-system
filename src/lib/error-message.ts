export function extractErrorMessage(input: unknown, fallback = '操作失败'): string {
  if (input == null) return fallback;

  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);

  if (input instanceof Error) return input.message || fallback;

  if (typeof input === 'object') {
    const anyInput = input as any;

    if (typeof anyInput.error === 'string') return anyInput.error;
    if (anyInput.error && typeof anyInput.error.message === 'string') return anyInput.error.message;

    if (typeof anyInput.message === 'string') return anyInput.message;

    try {
      return JSON.stringify(input);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

