export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }
  }
  return fallback;
}

export function isRequestCancelled(error: unknown): boolean {
  return getErrorMessage(error, '') === 'Request cancelled';
}

export function parseEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
