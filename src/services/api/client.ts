import axios, {AxiosRequestConfig, Method} from 'axios';
import type {ApiResponse, ServerConfig} from '../../types';
import {joinApiPath} from '../../utils/url';
import {normalizeApiError} from './errors';

export type TokenProvider = () => Promise<string | null> | string | null;

export class DbOnlineApi {
  constructor(
    private readonly getServerConfig: () => ServerConfig | null,
    private readonly getToken: TokenProvider,
  ) {}

  private async request<T>(
    method: Method,
    path: string,
    options: Omit<AxiosRequestConfig, 'method' | 'url'> = {},
  ): Promise<T> {
    const config = this.getServerConfig();
    if (!config) {
      throw new Error('尚未配置服务器');
    }

    const token = await this.getToken();
    try {
      const response = await axios.request<ApiResponse<T> | T>({
        ...options,
        method,
        url: joinApiPath(config.apiBaseUrl, path),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
          ...options.headers,
        },
      });

      const body = response.data as ApiResponse<T>;
      if (body && typeof body === 'object' && 'success' in body) {
        if (body.success === false) {
          throw new Error(body.error || body.message || '请求失败');
        }
        return (body.data ?? body) as T;
      }

      return response.data as T;
    } catch (error) {
      throw normalizeApiError(error);
    }
  }

  get<T>(path: string, options?: Omit<AxiosRequestConfig, 'method' | 'url'>) {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, data?: unknown, options?: Omit<AxiosRequestConfig, 'method' | 'url'>) {
    return this.request<T>('POST', path, {...options, data});
  }

  put<T>(path: string, data?: unknown, options?: Omit<AxiosRequestConfig, 'method' | 'url'>) {
    return this.request<T>('PUT', path, {...options, data});
  }

  patch<T>(path: string, data?: unknown, options?: Omit<AxiosRequestConfig, 'method' | 'url'>) {
    return this.request<T>('PATCH', path, {...options, data});
  }

  delete<T>(path: string, options?: Omit<AxiosRequestConfig, 'method' | 'url'>) {
    return this.request<T>('DELETE', path, options);
  }
}

