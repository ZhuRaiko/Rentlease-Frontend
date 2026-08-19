export type AppErrorCode = 'configuration' | 'network' | 'permission' | 'unknown';

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
}

export function normalizeError(error: unknown, fallback = 'Something went wrong.'): AppError {
  if (error instanceof Error) {
    return { code: 'unknown', message: error.message || fallback, cause: error };
  }
  return { code: 'unknown', message: fallback, cause: error };
}
