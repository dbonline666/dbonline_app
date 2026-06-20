import type {JsonRecord, VideoSummary, AuthStatus} from '../../types';
import type {DbOnlineApi} from './client';

export const createApiFacade = (api: DbOnlineApi) => ({
  getHealth: () => api.get<JsonRecord>('/health'),
  getReady: () => api.get<JsonRecord>('/ready'),
  getMetrics: () => api.get<JsonRecord>('/metrics'),
  health: () => api.get<JsonRecord>('/health'),
  ready: () => api.get<JsonRecord>('/ready'),
  metrics: () => api.get<JsonRecord>('/metrics'),

  authStatus: () => api.get<AuthStatus>('/auth/status'),
  authVerify: () => api.get<{valid: boolean}>('/auth/verify'),
  authLogin: (payload: {password?: string; totp_code?: string}) =>
    api.post<{token: string}>('/auth/login', payload),
  authLogout: () => api.post<JsonRecord>('/auth/logout'),
  authTOTPBegin: () => api.post<JsonRecord>('/auth/totp/begin'),
  authTOTPFinish: (payload: JsonRecord) => api.post<JsonRecord>('/auth/totp/finish', payload),
  authTOTPDelete: () => api.delete<JsonRecord>('/auth/totp'),
  authWebAuthnRegisterBegin: (payload: JsonRecord = {}) =>
    api.post<JsonRecord>('/auth/webauthn/register/begin', payload),
  authWebAuthnRegisterFinish: (sessionId: string, payload: JsonRecord, name = '') =>
    api.post<JsonRecord>('/auth/webauthn/register/finish', payload, {
      params: {session_id: sessionId, ...(name ? {name} : {})},
    }),
  authWebAuthnCredentialDelete: (id: string) =>
    api.delete<JsonRecord>(`/auth/webauthn/credentials/${encodeURIComponent(id)}`),
  authWebAuthnCredentialRename: (id: string, payload: JsonRecord) =>
    api.patch<JsonRecord>(`/auth/webauthn/credentials/${encodeURIComponent(id)}`, payload),
  authWebAuthnLoginBegin: () => api.post<JsonRecord>('/auth/webauthn/login/begin'),
  authWebAuthnLoginFinish: (sessionId: string, payload: JsonRecord) =>
    api.post<JsonRecord>('/auth/webauthn/login/finish', payload, {
      params: {session_id: sessionId},
    }),

  setupStatus: () => api.get<JsonRecord>('/setup/status'),
  setupTestConnection: (payload: JsonRecord) => api.post<JsonRecord>('/setup/test-connection', payload),
  setupListDatabases: (payload: JsonRecord) => api.post<JsonRecord>('/setup/list-databases', payload),
  setupCreateDatabase: (payload: JsonRecord) => api.post<JsonRecord>('/setup/create-database', payload),
  setupInitialize: (payload: JsonRecord) => api.post<JsonRecord>('/setup/initialize', payload),
  setupRestart: () => api.post<JsonRecord>('/setup/restart'),

  getConfig: (params?: JsonRecord) => api.get<JsonRecord>('/config', {params}),
  updateConfig: (data: JsonRecord) => api.put<JsonRecord>('/config', data),
  aiListModels: (payload: JsonRecord) => api.post<JsonRecord>('/ai/models', payload),
  aiTestConnection: (payload: JsonRecord) => api.post<JsonRecord>('/ai/test', payload),
  getStats: () => api.get<JsonRecord>('/stats'),
  getRecommendMovies: (page = 1, limit = 10) =>
    api.get<JsonRecord>('/recommend', {params: {page, limit}}),

  getVideos: (params: JsonRecord = {}) => api.get<JsonRecord>('/videos', {params}),
  getAllVideos: (
    page = 1,
    pageSize = 24,
    sort = '',
    order = '',
    filters: JsonRecord = {},
  ) =>
    api.get<JsonRecord>('/videos', {
      params: {
        page,
        pageSize,
        ...(sort ? {sort} : {}),
        ...(order ? {order} : {}),
        ...filters,
      },
    }),
  getVideo: (code: string, refresh = false) =>
    api.get<JsonRecord>(`/video/${encodeURIComponent(code)}`, {params: {refresh}}),
  getVideoById: (videoId: string, refresh = false) =>
    api.get<JsonRecord>(`/video/id/${encodeURIComponent(videoId)}`, {params: {refresh}}),
  getVideoDownloadHistory: (code: string) =>
    api.get<JsonRecord>(`/video/${encodeURIComponent(code)}/download-history`),
  getVideoByPath: (path: string) => api.get<JsonRecord>(`/v/${path}`),
  getVideosByFilter: (options: {
    actorId?: string;
    categoryId?: string;
    actor?: string;
    category?: string;
  } = {}) =>
    api.get<JsonRecord>('/videos/filter', {
      params: {
        ...(options.actorId ? {actor_id: options.actorId} : {}),
        ...(options.categoryId ? {category_id: options.categoryId} : {}),
        ...(options.actor ? {actor: options.actor} : {}),
        ...(options.category ? {category: options.category} : {}),
      },
    }),
  getUserScore: (code: string) => api.get<JsonRecord>(`/video/${encodeURIComponent(code)}/score`),
  setUserScore: (code: string, score: number) =>
    api.put<JsonRecord>(`/video/${encodeURIComponent(code)}/score`, {score}),
  recheckVideos: (data: JsonRecord) => api.post<JsonRecord>('/videos/recheck', data),
  batchDeleteVideos: (codes: string[]) => api.post<JsonRecord>('/videos/batch/delete', {codes}),
  batchRecollectVideos: (codes: string[]) => api.post<JsonRecord>('/videos/batch/recollect', {codes}),
  getLibraryStream: (code: string) => api.get<JsonRecord>(`/library/stream/${encodeURIComponent(code)}`),
  getLibraryCacheStats: () => api.get<JsonRecord>('/library/cache/stats'),
  refreshLibraryCache: () => api.post<JsonRecord>('/library/cache/refresh'),
  getLibraryCacheRefreshProgress: () => api.get<JsonRecord>('/library/cache/refresh/progress'),
  getLoginCovers: (limit = 36) => api.get<JsonRecord>('/login/covers', {params: {limit}}),

  search: (params: JsonRecord) => api.get<JsonRecord>('/search', {params}),
  searchActors: (q: string) => api.get<JsonRecord>('/search/actors', {params: {q}}),
  searchActorsByImage: (formData: FormData) =>
    api.post<JsonRecord>('/search/image?target=actor', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    }),
  getActorMovies: (actorId: string, params: JsonRecord) =>
    api.get<JsonRecord>(`/actors/${encodeURIComponent(actorId)}/movies`, {params}),
  getSeriesMovies: (seriesId: string, page = 1, limit = 24, sortBy = 'release', orderBy = 'desc', filter = '') =>
    api.get<JsonRecord>(`/series/${encodeURIComponent(seriesId)}/movies`, {
      params: {page, limit, sort_by: sortBy, order_by: orderBy, ...(filter ? {filter} : {})},
    }),
  getMakerMovies: (makerId: string, page = 1, limit = 24, sortBy = 'release', orderBy = 'desc', filter = '') =>
    api.get<JsonRecord>(`/makers/${encodeURIComponent(makerId)}/movies`, {
      params: {page, limit, sort_by: sortBy, order_by: orderBy, ...(filter ? {filter} : {})},
    }),
  getPublisherMovies: (publisherId: string, page = 1, limit = 24, sortBy = 'release', orderBy = 'desc', filter = '') =>
    api.get<JsonRecord>(`/publishers/${encodeURIComponent(publisherId)}/movies`, {
      params: {page, limit, sort_by: sortBy, order_by: orderBy, ...(filter ? {filter} : {})},
    }),
  getDirectorMovies: (directorId: string, page = 1, limit = 24, sortBy = 'release', orderBy = 'desc', filter = '') =>
    api.get<JsonRecord>(`/directors/${encodeURIComponent(directorId)}/movies`, {
      params: {page, limit, sort_by: sortBy, order_by: orderBy, ...(filter ? {filter} : {})},
    }),
  getListMovies: (listId: string, page = 1, limit = 24, sortBy = 'release', orderBy = 'desc', filter = '') =>
    api.get<JsonRecord>(`/lists/${encodeURIComponent(listId)}/movies`, {
      params: {page, limit, sort_by: sortBy, order_by: orderBy, ...(filter ? {filter} : {})},
    }),
  getEntityMovies: (entity: 'series' | 'makers' | 'publishers' | 'directors' | 'lists', id: string, params: JsonRecord) =>
    api.get<JsonRecord>(`/${entity}/${encodeURIComponent(id)}/movies`, {params}),
  getRelatedLists: (movieId: string, page = 1, limit = 24) =>
    api.get<JsonRecord>('/lists/related', {params: {movie_id: movieId, page, limit}}),
  getUserReviewResources: (userId: string, {page = 1, limit = 24, username = ''} = {}) =>
    api.get<JsonRecord>(`/users/${encodeURIComponent(userId)}/resources`, {
      params: {page, limit, ...(username ? {username} : {})},
    }),
  getUserReviewResourceMetadata: (items: JsonRecord[] = []) =>
    api.post<JsonRecord>('/users/resources/metadata', {items}),

  getRankings: (period = 'daily', type = 0) => api.get<JsonRecord>('/rankings', {params: {period, type}}),
  getTop250: (params: JsonRecord) => api.get<JsonRecord>('/top250', {params}),
  subscribeTop250: (payload: JsonRecord) => api.post<JsonRecord>('/top250/subscribe', payload),
  getLatestMovies: (params: JsonRecord) => api.get<JsonRecord>('/latest', {params}),
  getActors: (type = 0) => api.get<JsonRecord>('/actors', {params: {type}}),
  getActorOptions: () => api.get<JsonRecord>('/options/actors'),
  getCategories: () => api.get<JsonRecord>('/options/categories'),
  getActorCategories: (actorId: string) => api.get<JsonRecord>(`/options/categories/${encodeURIComponent(actorId)}`),

  getSubscriptions: (params: JsonRecord = {}) => api.get<JsonRecord>('/subs', {params}),
  createSubscription: (data: JsonRecord) => api.post<JsonRecord>('/subs', data),
  updateSubscription: (code: string, data: JsonRecord) =>
    api.put<JsonRecord>(`/subs/${encodeURIComponent(code)}`, data),
  deleteSubscription: (code: string) => api.delete<JsonRecord>(`/subs/${encodeURIComponent(code)}`),
  checkSubscription: (code: string) => api.post<JsonRecord>(`/subs/check/${encodeURIComponent(code)}`),
  batchCheckSubscriptions: (codes: string[]) => api.post<JsonRecord>('/subs/check', {codes}),
  batchCheckSubscriptionStatus: (payload: JsonRecord | string[] = []) =>
    api.post<JsonRecord>('/subs/status', Array.isArray(payload) ? {codes: payload} : payload),
  syncOnlineSubscriptions: () => api.post<JsonRecord>('/subs/sync'),
  getOnlineSubscriptions: (params: JsonRecord = {}) => api.get<JsonRecord>('/subs/live-sub', {params}),
  getWatchedMovies: (params: JsonRecord = {}) => api.get<JsonRecord>('/subs/watched', {params}),
  getTaggedMovies: (params: JsonRecord) => api.get<JsonRecord>('/subs/tags', {params}),
  getSubscriptionLog: (params: JsonRecord = {}) => api.get<JsonRecord>('/subs/logs', {params}),
  clearSubscriptionLog: (date: string | null = null) =>
    api.delete<JsonRecord>('/subs/logs', {params: date ? {date} : {}}),
  getSubscriptionMatrix: (params: JsonRecord = {}) => api.get<JsonRecord>('/subs/matrix', {params}),
  getAutoSyncStatus: () => api.get<JsonRecord>('/subs/auto-sync'),
  updateAutoSync: (data: JsonRecord) => api.put<JsonRecord>('/subs/auto-sync', data),
  getSubscriptionPreset: () => api.get<JsonRecord>('/subs/preset'),
  updateSubscriptionPreset: (data: JsonRecord) => api.put<JsonRecord>('/subs/preset', data),
  overwriteSubscriptionPreset: (data: JsonRecord) => api.post<JsonRecord>('/subs/preset/overwrite', data),
  exportSubscriptionShare: (data: JsonRecord) => api.post<JsonRecord>('/subs/share/export', data),
  analyzeSubscriptionShare: (data: JsonRecord) => api.post<JsonRecord>('/subs/share/analyze', data),
  importSubscriptionShare: (data: JsonRecord) => api.post<JsonRecord>('/subs/share/import', data),
  getRankingAutoConfig: () => api.get<JsonRecord>('/subs/ranking'),
  updateRankingAutoConfig: (config: JsonRecord) => api.put<JsonRecord>('/subs/ranking', {config}),

  getFollowingPresets: () => api.get<JsonRecord>('/following/presets'),
  createFollowingPreset: (data: JsonRecord) => api.post<JsonRecord>('/following/presets', data),
  updateFollowingPreset: (id: string | number, data: JsonRecord) =>
    api.put<JsonRecord>(`/following/presets/${encodeURIComponent(String(id))}`, data),
  deleteFollowingPreset: (id: string | number) =>
    api.delete<JsonRecord>(`/following/presets/${encodeURIComponent(String(id))}`),
  reorderFollowingPresets: (ids: Array<string | number>) =>
    api.put<JsonRecord>('/following/presets/reorder', {ids}),
  getFollowedReviewUsers: () => api.get<JsonRecord>('/following/users'),
  getFollowedReviewUser: (userId: string) =>
    api.get<JsonRecord>(`/following/users/${encodeURIComponent(userId)}`),
  followReviewUser: (data: JsonRecord) => api.post<JsonRecord>('/following/users', data),
  unfollowReviewUsers: (user_ids: string[]) => api.delete<JsonRecord>('/following/users', {data: {user_ids}}),

  getActorSubscriptions: (params: JsonRecord = {}) => api.get<JsonRecord>('/actor-subs', {params}),
  createActorSubscription: (data: JsonRecord) => api.post<JsonRecord>('/actor-subs', data),
  getActorSubscription: (actorId: string) => api.get<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}`),
  updateActorSubscription: (actorId: string, data: JsonRecord) =>
    api.put<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}`, data),
  deleteActorSubscription: (actorId: string) =>
    api.delete<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}`),
  checkActorSubscription: (actorId: string) =>
    api.post<JsonRecord>(`/actor-subs/check/${encodeURIComponent(actorId)}`),
  batchCheckActorSubscriptions: (actorIds: string[] = []) =>
    api.post<JsonRecord>('/actor-subs/check', {actor_ids: actorIds}),
  runActorSubscriptions: () => api.post<JsonRecord>('/actor-subs/run'),
  runActorSubscription: (actorId: string) =>
    api.post<JsonRecord>(`/actor-subs/run/${encodeURIComponent(actorId)}`),
  getActorSubscriptionVideos: (actorId: string, {status = '', page = 0, limit = 0} = {}) =>
    api.get<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}`, {
      params: {videos: true, ...(status ? {status} : {}), ...(page > 0 ? {page} : {}), ...(limit > 0 ? {limit} : {})},
    }),
  batchSkipActorSubscriptionVideos: (actorId: string, codes: string[] = []) =>
    api.post<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}/videos/skip`, {codes}),
  batchRestoreActorSubscriptionVideos: (actorId: string, codes: string[] = []) =>
    api.post<JsonRecord>(`/actor-subs/${encodeURIComponent(actorId)}/videos/restore`, {codes}),
  updateActorSubscriptionVideo: (actorId: string, videoCode: string, data: JsonRecord) =>
    api.put<JsonRecord>(
      `/actor-subs/${encodeURIComponent(actorId)}/videos/${encodeURIComponent(videoCode)}`,
      data,
    ),
  skipActorSubscriptionVideo: (actorId: string, videoCode: string) =>
    api.put<JsonRecord>(
      `/actor-subs/${encodeURIComponent(actorId)}/videos/${encodeURIComponent(videoCode)}`,
      {status: 'skipped'},
    ),
  getSeriesSubscriptions: (params: JsonRecord = {}) => api.get<JsonRecord>('/series-subs', {params}),
  createSeriesSubscription: (data: JsonRecord) => api.post<JsonRecord>('/series-subs', data),
  getSeriesSubscription: (externalId: string, subType = 'series') =>
    api.get<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}`, {params: {sub_type: subType}}),
  updateSeriesSubscription: (externalId: string, data: JsonRecord, subType = 'series') =>
    api.put<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}`, data, {params: {sub_type: subType}}),
  deleteSeriesSubscription: (externalId: string, subType = 'series') =>
    api.delete<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}`, {params: {sub_type: subType}}),
  checkSeriesSubscription: (externalId: string, subType = 'series') =>
    api.post<JsonRecord>(`/series-subs/check/${encodeURIComponent(externalId)}`, null, {params: {sub_type: subType}}),
  batchCheckSeriesSubscriptions: (externalIds: string[] = [], subType = 'series') =>
    api.post<JsonRecord>('/series-subs/check', {external_ids: externalIds, sub_type: subType}),
  runSeriesSubscriptions: (sub_type = 'series') =>
    api.post<JsonRecord>('/series-subs/run', null, {params: {sub_type}}),
  runSeriesSubscription: (externalId: string, subType = 'series') =>
    api.post<JsonRecord>(`/series-subs/run/${encodeURIComponent(externalId)}`, null, {params: {sub_type: subType}}),
  getSeriesSubscriptionVideos: (
    externalId: string,
    {status = '', page = 0, limit = 0, subType = 'series'} = {},
  ) =>
    api.get<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}`, {
      params: {
        videos: true,
        sub_type: subType,
        ...(status ? {status} : {}),
        ...(page > 0 ? {page} : {}),
        ...(limit > 0 ? {limit} : {}),
      },
    }),
  batchSkipSeriesSubscriptionVideos: (externalId: string, codes: string[] = [], subType = 'series') =>
    api.post<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}/videos/skip`, {codes}, {params: {sub_type: subType}}),
  batchRestoreSeriesSubscriptionVideos: (externalId: string, codes: string[] = [], subType = 'series') =>
    api.post<JsonRecord>(`/series-subs/${encodeURIComponent(externalId)}/videos/restore`, {codes}, {params: {sub_type: subType}}),
  updateSeriesSubscriptionVideo: (externalId: string, videoCode: string, data: JsonRecord, subType = 'series') =>
    api.put<JsonRecord>(
      `/series-subs/${encodeURIComponent(externalId)}/videos/${encodeURIComponent(videoCode)}`,
      data,
      {params: {sub_type: subType}},
    ),
  skipSeriesSubscriptionVideo: (externalId: string, videoCode: string, subType = 'series') =>
    api.put<JsonRecord>(
      `/series-subs/${encodeURIComponent(externalId)}/videos/${encodeURIComponent(videoCode)}`,
      {status: 'skipped'},
      {params: {sub_type: subType}},
    ),

  cancelScheduler: () => api.post<JsonRecord>('/scheduler/cancel'),
  cancelQueuedTask: (taskId: string) => api.post<JsonRecord>('/scheduler/cancel-queued', {taskId}),
  getDownloaders: (params?: JsonRecord) => api.get<JsonRecord>('/downloaders', {params}),
  download: (payload: JsonRecord) => api.post<JsonRecord>('/download', payload),
  downloadLegacy: (urls: string[], downloader = '', savePath = '', videoInfo: JsonRecord | null = null, recordResources: JsonRecord[] = []) =>
    api.post<JsonRecord>('/download', {
      urls,
      downloader,
      save_path: savePath,
      video_info: videoInfo,
      record_resources: recordResources,
    }),
  getDownloadRecords: (params: JsonRecord = {}) => api.get<JsonRecord>('/download-records', {params}),
  clearDownloadRecords: () => api.delete<JsonRecord>('/download-records'),

  aria2Tasks: () => api.get<JsonRecord>('/aria2/tasks'),
  aria2Action: (payload: JsonRecord) => api.post<JsonRecord>('/aria2/action', payload),
  aria2Test: (payload: JsonRecord) => api.post<JsonRecord>('/aria2/test', payload),
  qbittorrentTasks: (filter = 'all') => api.get<JsonRecord>('/qbittorrent/tasks', {params: {filter}}),
  qbittorrentAction: (payload: JsonRecord) => api.post<JsonRecord>('/qbittorrent/action', payload),
  qbittorrentTest: (payload: JsonRecord) => api.post<JsonRecord>('/qbittorrent/test', payload),
  thunderTest: (payload: JsonRecord) => api.post<JsonRecord>('/thunder/test', payload),
  thunderTasks: () => api.get<JsonRecord>('/thunder/tasks'),
  thunderAction: (payload: JsonRecord) => api.post<JsonRecord>('/thunder/action', payload),
  thunderSelectOptions: (payload: JsonRecord) => api.post<JsonRecord>('/thunder/select-options', payload),
  thunderReviewProbeHistory: () => api.get<JsonRecord>('/thunder/review-probe-history'),
  pan115Test: (payload: JsonRecord | null = null) =>
    payload ? api.post<JsonRecord>('/pan115/test', payload) : api.get<JsonRecord>('/pan115/test'),
  pan115Tasks: (filter = 'downloading', page = 1, pageSize = 15) =>
    api.get<JsonRecord>('/pan115/tasks', {params: {filter, page, page_size: pageSize}}),
  pan115GetDirectories: (payload: JsonRecord) => api.post<JsonRecord>('/pan115/directories', payload),
  openlistTest: (payload: JsonRecord) => api.post<JsonRecord>('/openlist/test', payload),
  openlistToolPaths: (payload: JsonRecord) => api.post<JsonRecord>('/openlist/tool-paths', payload),
  clouddrive2Test: (payload: JsonRecord) => api.post<JsonRecord>('/clouddrive2/test', payload),
  embyTest: (payload: JsonRecord) => api.post<JsonRecord>('/emby/test', payload),
  embyGetLibraries: (payload: JsonRecord) => api.post<JsonRecord>('/emby/libraries', payload),
  fnmediaTest: (payload: JsonRecord) => api.post<JsonRecord>('/fnmedia/test', payload),
  fnmediaGetLibraries: (payload: JsonRecord) => api.post<JsonRecord>('/fnmedia/libraries', payload),
  jellyfinTest: (payload: JsonRecord) => api.post<JsonRecord>('/jellyfin/test', payload),
  jellyfinGetLibraries: (payload: JsonRecord) => api.post<JsonRecord>('/jellyfin/libraries', payload),
  telegramTestNotification: () => api.get<JsonRecord>('/telegram/test-notification'),

  getPlayerConfig: () => api.get<JsonRecord>('/settings/player'),
  updatePlayerConfig: (config: JsonRecord) => api.put<JsonRecord>('/settings/player', config),
  getAppLog: (params: JsonRecord = {}) => api.get<JsonRecord>('/logs', {params}),
  getImageCacheStats: () => api.get<JsonRecord>('/image/stats'),
  clearImageCache: () => api.delete<JsonRecord>('/image/cache'),
  getCustomMagnets: (code: string) => api.get<JsonRecord>(`/external-magnets/custom/${encodeURIComponent(code)}`),
  getCustomMagnetStats: () => api.get<JsonRecord>('/external-magnets/stats'),
  getNyaaMagnets: (code: string) => api.get<JsonRecord>(`/external-magnets/nyaa/${encodeURIComponent(code)}`),
  getSubtitleStats: () => api.get<JsonRecord>('/subtitle/stats'),
  scanSubtitles: (mode = 'incremental') => api.post<JsonRecord>('/subtitle/scan', null, {params: {mode}}),
  getSubtitleProgress: () => api.get<JsonRecord>('/subtitle/progress'),
  findSubtitle: (code: string) => api.get<JsonRecord>(`/subtitle/find/${encodeURIComponent(code)}`),
  clearSubtitleCache: () => api.post<JsonRecord>('/subtitle/clear'),
  getSubtitleDownloadUrl: (id: string) => `subtitle/download?id=${encodeURIComponent(id)}`,
  downloadSubtitle: (id: string) =>
    api.get<unknown>(`/subtitle/download?id=${encodeURIComponent(id)}`, {responseType: 'blob'}),
  previewSubtitle: (id: string, enc = '') =>
    api.get<JsonRecord>('/subtitle/preview', {params: {id, ...(enc ? {enc} : {})}}),
  searchExternalSubtitle: (code: string) =>
    api.get<JsonRecord>(`/subtitle/external/search/${encodeURIComponent(code)}`),
  previewExternalSubtitle: (url: string, enc = '') =>
    api.get<JsonRecord>('/subtitle/external/preview', {params: {url, ...(enc ? {enc} : {})}}),
  downloadExternalSubtitle: (url: string, name: string, ext: string) =>
    api.get<unknown>('/subtitle/external/download', {
      params: {url, name, ext},
      responseType: 'blob',
    }),
  getBlacklist: (params: JsonRecord = {}) => api.get<JsonRecord>('/blacklist', {params}),
  addToBlacklist: (data: JsonRecord) => api.post<JsonRecord>('/blacklist', data),
  removeFromBlacklist: (videoCode: string) =>
    api.delete<JsonRecord>(`/blacklist/${encodeURIComponent(videoCode)}`),
  batchRemoveFromBlacklist: (video_codes: string[]) =>
    api.delete<JsonRecord>('/blacklist', {data: {video_codes}}),
  testBlacklist: (video_codes: string[]) => api.post<JsonRecord>('/blacklist/test', {video_codes}),
  javdbLogin: (payload: JsonRecord) => api.post<JsonRecord>('/get-token', payload),
  probeUrlPresets: (urls: string[]) => api.post<JsonRecord>('/url-presets/probe', {urls}),
});

export const extractList = <T = VideoSummary>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of ['videos', 'movies', 'items', 'list', 'results', 'data', 'subscriptions', 'tasks', 'records', 'users', 'presets']) {
    if (Array.isArray(record[key])) {
      return record[key] as T[];
    }
  }

  if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) {
    const data = record.data as Record<string, unknown>;
    for (const key of ['videos', 'movies', 'items', 'list', 'results', 'subscriptions', 'tasks', 'records', 'users', 'presets']) {
      if (Array.isArray(data[key])) {
        return data[key] as T[];
      }
    }
  }

  return [];
};

export const displayVideoTitle = (item: VideoSummary) =>
  item.title || item.code || item.id || 'Untitled';
