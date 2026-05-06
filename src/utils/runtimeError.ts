function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
}

export function getErrorResponseStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  const response = error.response;
  if (!isRecord(response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}
