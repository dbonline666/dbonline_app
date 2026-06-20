import {AxiosError} from 'axios';
import type {ApiError} from '../../types';

export const isLocalOnlyAccessError = (status: number | null, headers: unknown, data: unknown) => {
  if (status !== 403) {
    return false;
  }

  const headerBag = headers as Record<string, unknown> | undefined;
  const headerFlag = String(headerBag?.['x-access-restriction'] || '').toLowerCase();
  if (headerFlag === 'local-only') {
    return true;
  }

  const response = data as {error?: unknown} | undefined;
  return typeof response?.error === 'string' && response.error.includes('仅允许内网访问');
};

export const normalizeApiError = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? null;
    const data = error.response?.data as {error?: string; message?: string} | undefined;
    const message = data?.error || data?.message || error.message || '请求失败';
    const accessRestriction = isLocalOnlyAccessError(
      status,
      error.response?.headers,
      error.response?.data,
    )
      ? 'local-only'
      : null;

    return {
      status,
      message,
      accessRestriction,
      retryable: !status || status >= 500 || status === 408 || status === 429,
    };
  }

  return {
    status: null,
    message: error instanceof Error ? error.message : '请求失败',
    accessRestriction: null,
    retryable: true,
  };
};

