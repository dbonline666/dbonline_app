export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {[key: string]: JsonValue};

export type JsonRecord = {[key: string]: JsonValue};

export type ThemeMode = 'system' | 'light' | 'dark';
export type AppLocale = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP';

export type ServerConfig = {
  rawUrl: string;
  origin: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  lastVerifiedAt: string;
};

export type AuthStatus = {
  enabled: boolean;
  configured: boolean;
  reachable?: boolean;
  error?: string;
};

export type AuthSession = {
  token: string;
  authStatus: AuthStatus | null;
  expiresAt: string | null;
};

export type ApiError = {
  status: number | null;
  message: string;
  accessRestriction: 'local-only' | null;
  retryable: boolean;
};

export type ApiResponse<T = JsonValue> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export type VideoSummary = {
  id?: string;
  code?: string;
  title?: string;
  cover?: string;
  cover_url?: string;
  score?: number;
  user_score?: number;
  release_date?: string;
  date?: string;
  actors?: string[] | JsonRecord[];
  categories?: string[] | JsonRecord[];
  [key: string]: unknown;
};

export type ListPayload<T = JsonRecord> = {
  items: T[];
  total?: number;
  page?: number;
};

