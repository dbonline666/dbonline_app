import type {ServerConfig} from '../types';

const stripTrailingSlash = (value: string) => value.replace(/\/+$/u, '');

const withProtocol = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('服务器地址不能为空');
  }
  if (/^https?:\/\//iu.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
};

export const normalizeServerConfig = (
  rawUrl: string,
  verifiedAt = new Date().toISOString(),
): ServerConfig => {
  let parsed: URL;
  try {
    parsed = new URL(withProtocol(rawUrl));
  } catch {
    throw new Error('服务器地址格式无效');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('仅支持 HTTP 或 HTTPS 地址');
  }

  const origin = stripTrailingSlash(parsed.origin);

  return {
    rawUrl: rawUrl.trim(),
    origin,
    apiBaseUrl: `${origin}/api`,
    wsBaseUrl: `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${
      parsed.host
    }/ws`,
    lastVerifiedAt: verifiedAt,
  };
};

export const joinApiPath = (apiBaseUrl: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${stripTrailingSlash(apiBaseUrl)}${normalizedPath}`;
};

export const buildSchedulerWsUrl = (wsBaseUrl: string) =>
  `${stripTrailingSlash(wsBaseUrl)}/scheduler/status`;

