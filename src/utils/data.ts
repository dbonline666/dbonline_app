import type {JsonRecord, ServerConfig, VideoSummary} from '../types';

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const pickString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
};

export const pickNumber = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

export const absoluteUrl = (serverConfig: ServerConfig | null, url?: string) => {
  if (!url) {
    return '';
  }
  if (/^https?:\/\//iu.test(url)) {
    return url;
  }
  if (!serverConfig) {
    return url;
  }
  return `${serverConfig.origin}${url.startsWith('/') ? url : `/${url}`}`;
};

export const normalizeVideo = (
  item: unknown,
  serverConfig: ServerConfig | null,
): VideoSummary => {
  const record = asRecord(item);
  const code = pickString(record, ['code', 'video_code', 'number', 'id']);
  const title = pickString(record, ['title', 'name', 'display_name']);
  const cover = absoluteUrl(
    serverConfig,
    pickString(record, ['cover', 'cover_url', 'poster', 'image', 'image_url']),
  );

  return {
    ...record,
    id: pickString(record, ['id', 'video_id']) || code,
    code,
    title,
    cover,
    score: pickNumber(record, ['score', 'rating']) ?? undefined,
    user_score: pickNumber(record, ['user_score']) ?? undefined,
    release_date: pickString(record, ['release_date', 'date']),
  } as VideoSummary;
};

export const summarizeRecord = (value: unknown) => {
  const record = asRecord(value);
  const entries = Object.entries(record)
    .filter(([, entry]) => ['string', 'number', 'boolean'].includes(typeof entry))
    .slice(0, 4)
    .map(([key, entry]) => `${key}: ${String(entry)}`);
  return entries.join('\n') || JSON.stringify(value);
};

export const toJsonRecord = (value: unknown): JsonRecord =>
  asRecord(value) as JsonRecord;

