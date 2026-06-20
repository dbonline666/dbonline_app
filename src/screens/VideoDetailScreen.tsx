import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  KeyValueRow,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TextButton,
  VideoThumb,
  useAppColors,
} from '../components/ui';
import {extractList} from '../services/api/endpoints';
import {useAppState} from '../state/AppState';
import {radius, spacing} from '../theme';
import type {RootStackParamList} from '../navigation/types';
import type {JsonRecord, ServerConfig, VideoSummary} from '../types';
import {
  absoluteUrl,
  asRecord,
  normalizeVideo,
  pickNumber,
  pickString,
  summarizeRecord,
} from '../utils/data';

type Props = NativeStackScreenProps<RootStackParamList, 'VideoDetail'>;
type ScoreValue = '0' | '1' | '2' | '3' | '4' | '5';
type ResourceKind = 'magnet' | 'ed2k';
type ResourceRecord = Record<string, unknown>;

const scoreOptions: ScoreValue[] = ['0', '1', '2', '3', '4', '5'];

const hiddenDetailKeys = new Set([
  'actors',
  'actor_movies',
  'categories',
  'cover',
  'cover_url',
  'ed2ks',
  'magnets',
  'preview_images',
  'previews',
  'relative_movies',
  'samples',
]);

const clampScore = (value: unknown): ScoreValue => {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return '0';
  }
  return String(Math.min(5, Math.max(0, Math.round(score)))) as ScoreValue;
};

const extractNestedList = <T = ResourceRecord>(payload: unknown, keys: string[] = []): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as T[];
    }
  }

  const data = record.data;
  if (data && data !== payload) {
    const nested = extractNestedList<T>(data, keys);
    if (nested.length) {
      return nested;
    }
  }

  return extractList<T>(payload);
};

const apiFileUrl = (serverConfig: ServerConfig | null, path: string) => {
  if (!serverConfig) {
    return path;
  }
  return `${serverConfig.apiBaseUrl.replace(/\/+$/u, '')}/${path.replace(/^\/+/u, '')}`;
};

const extractImages = (record: ResourceRecord, serverConfig: ServerConfig | null) => {
  const images: string[] = [];
  const append = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) {
      images.push(absoluteUrl(serverConfig, value.trim()));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }

    const next = asRecord(value);
    for (const key of ['url', 'src', 'image', 'image_url', 'preview', 'thumbnail', 'large']) {
      append(next[key]);
    }
  };

  append(record.previews);
  append(record.preview_images);
  append(record.samples);
  append(record.sample_images);

  return Array.from(new Set(images)).filter(Boolean);
};

const extractEntityItems = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .map(item => {
      if (typeof item === 'string') {
        return {id: '', label: item};
      }
      const record = asRecord(item);
      return {
        id: pickString(record, ['id', 'actor_id', 'category_id', 'external_id']),
        label: pickString(record, ['name', 'title', 'label']),
      };
    })
    .filter(item => item.label || item.id);

const normalizeVideoItems = (payload: unknown, serverConfig: ServerConfig | null) =>
  extractNestedList<VideoSummary>(payload, ['videos', 'items', 'results', 'data'])
    .map(item => normalizeVideo(item, serverConfig))
    .filter(item => item.code || item.id);

const resourceUrl = (resource: ResourceRecord, kind: ResourceKind) =>
  pickString(resource, kind === 'magnet' ? ['magnet', 'url', 'link'] : ['ed2k', 'url', 'link']);

const resourceTitle = (resource: ResourceRecord, kind: ResourceKind) =>
  pickString(resource, ['name', 'title', 'filename', 'file_name']) || resourceUrl(resource, kind);

const formatSize = (value: unknown) => {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    return '';
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(size)} MB`;
};

const resourceBadges = (resource: ResourceRecord) => {
  const tags = Array.isArray(resource.tags) ? resource.tags.map(String) : [];
  const badges: string[] = [];
  const name = resourceTitle(resource, 'magnet').toLowerCase();
  if (tags.some(tag => tag.toLowerCase().includes('uhd') || tag === '4K') || name.includes('4k')) {
    badges.push('UHD');
  } else if (tags.some(tag => tag.toLowerCase().includes('hd'))) {
    badges.push('HD');
  }
  if (tags.some(tag => tag.includes('字幕') || tag.toLowerCase().includes('sub'))) {
    badges.push('字幕');
  }
  if (tags.some(tag => tag.includes('无码') || tag.includes('破解'))) {
    badges.push('无码');
  }
  return badges;
};

const mergeResources = (kind: ResourceKind, ...groups: ResourceRecord[][]) => {
  const map = new Map<string, ResourceRecord>();
  for (const group of groups) {
    for (const item of group) {
      const key = resourceUrl(item, kind).trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const dateA = String(a.date || '');
    const dateB = String(b.date || '');
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    return Number(b.size_mb || 0) - Number(a.size_mb || 0);
  });
};

const resolveSubscriptionState = (detail: ResourceRecord, statusPayload: unknown, code: string) => {
  const subscription = asRecord(detail.subscription);
  if (subscription.active === true || Boolean(subscription.completed_at)) {
    return true;
  }

  const status = asRecord(statusPayload);
  const data = asRecord(status.data);
  const candidates = [
    status.subscribed,
    status.active,
    data.subscribed,
    data.active,
    status[code],
    data[code],
  ];

  for (const candidate of candidates) {
    if (candidate === true) {
      return true;
    }
    const record = asRecord(candidate);
    if (record.subscribed === true || record.active === true || Boolean(record.completed_at)) {
      return true;
    }
  }

  return false;
};

function PreviewStrip({images}: {images: string[]}) {
  const colors = useAppColors();
  if (!images.length) {
    return null;
  }

  return (
    <Card title={`预览图 (${images.length})`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewStrip}>
        {images.map((image, index) => (
          <Pressable key={`${image}-${index}`} onPress={() => Linking.openURL(image)}>
            <Image source={{uri: image}} style={[styles.previewImage, {backgroundColor: colors.border}]} />
            <Text style={[styles.previewIndex, {color: colors.mutedText}]}>{index + 1}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

function VideoRail({
  title,
  items,
  onPress,
}: {
  title: string;
  items: VideoSummary[];
  onPress: (item: VideoSummary) => void;
}) {
  const colors = useAppColors();
  if (!items.length) {
    return null;
  }

  return (
    <Card title={`${title} (${items.length})`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRail}>
        {items.slice(0, 20).map((item, index) => (
          <Pressable
            key={item.id || item.code || String(index)}
            onPress={() => onPress(item)}
            style={({pressed}) => [styles.videoRailItem, {opacity: pressed ? 0.72 : 1}]}>
            <VideoThumb uri={item.cover || item.cover_url} />
            <Text style={[styles.videoRailTitle, {color: colors.text}]} numberOfLines={2}>
              {item.title || item.code || item.id}
            </Text>
            <Text style={[styles.videoRailMeta, {color: colors.mutedText}]} numberOfLines={1}>
              {item.code || item.release_date || item.date}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

function EntityChips({
  title,
  items,
  onPress,
}: {
  title: string;
  items: {id: string; label: string}[];
  onPress: (item: {id: string; label: string}) => void;
}) {
  const colors = useAppColors();
  if (!items.length) {
    return null;
  }

  return (
    <Card title={title}>
      <View style={styles.chipWrap}>
        {items.map((item, index) => (
          <Pressable
            key={`${item.id}-${item.label}-${index}`}
            onPress={() => onPress(item)}
            style={({pressed}) => [
              styles.chip,
              {backgroundColor: colors.elevated, borderColor: colors.border, opacity: pressed ? 0.72 : 1},
            ]}>
            <Text style={{color: colors.text, fontWeight: '700'}}>{item.label || item.id}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function ResourceSection({
  title,
  kind,
  resources,
  loading,
  onShare,
  onPush,
  onOpenUser,
}: {
  title: string;
  kind: ResourceKind;
  resources: ResourceRecord[];
  loading?: boolean;
  onShare: (url: string) => void;
  onPush: (resource: ResourceRecord, kind: ResourceKind) => void;
  onOpenUser: (resource: ResourceRecord) => void;
}) {
  const colors = useAppColors();

  return (
    <Card title={`${title} (${resources.length})`}>
      {loading ? <LoadingState label="资源加载中" /> : null}
      {!loading && !resources.length ? <EmptyState label="暂无资源" /> : null}
      {resources.map((resource, index) => {
        const url = resourceUrl(resource, kind);
        const sourceUserId = pickString(resource, ['source_user_id', 'user_id']);
        const sourceUsername = pickString(resource, ['source_username', 'username']);
        return (
          <View key={`${url}-${index}`} style={[styles.resourceRow, {borderBottomColor: colors.border}]}>
            <Text style={[styles.resourceTitle, {color: colors.text}]} numberOfLines={2}>
              {resourceTitle(resource, kind)}
            </Text>
            <Text style={[styles.resourceMeta, {color: colors.mutedText}]} numberOfLines={2}>
              {[formatSize(resource.size_mb), String(resource.date || ''), String(resource.site || '')]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.badgeRow}>
              {resourceBadges(resource).map(badge => (
                <Badge key={badge} label={badge} tone={badge === '字幕' ? 'success' : 'neutral'} />
              ))}
              {Number(resource.file_count || 0) >= 10 ? <Badge label="多文件" tone="warning" /> : null}
            </View>
            <View style={styles.actionRow}>
              <TextButton label="分享" onPress={() => onShare(url)} />
              <TextButton label="推送下载" onPress={() => onPush(resource, kind)} />
              {sourceUserId ? (
                <TextButton label={sourceUsername || '用户资源'} onPress={() => onOpenUser(resource)} />
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function JsonRows({items}: {items: ResourceRecord[]}) {
  const colors = useAppColors();
  if (!items.length) {
    return <EmptyState />;
  }
  return (
    <>
      {items.slice(0, 12).map((item, index) => (
        <View key={String(item.id || item.code || index)} style={[styles.resourceRow, {borderBottomColor: colors.border}]}>
          <Text style={[styles.resourceTitle, {color: colors.text}]} numberOfLines={2}>
            {pickString(item, ['title', 'name', 'code', 'id']) || `#${index + 1}`}
          </Text>
          <Text style={[styles.resourceMeta, {color: colors.mutedText}]}>{summarizeRecord(item)}</Text>
        </View>
      ))}
    </>
  );
}

export function VideoDetailScreen({navigation, route}: Props) {
  const {api, serverConfig} = useAppState();
  const colors = useAppColors();
  const [score, setScore] = useState<ScoreValue>('0');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedUser, setSelectedUser] = useState<{id: string; username: string} | null>(null);
  const code = route.params.code;

  const detail = useQuery({
    queryKey: ['video-detail', code, route.params.videoId, refreshNonce],
    queryFn: async () => {
      const forceRefresh = refreshNonce > 0;
      if (route.params.videoId) {
        return api.getVideoById(route.params.videoId, forceRefresh);
      }
      try {
        return await api.getVideo(code, forceRefresh);
      } catch (error) {
        if (!forceRefresh) {
          return api.getVideoByPath(code);
        }
        throw error;
      }
    },
  });

  const video = useMemo(() => normalizeVideo(detail.data, serverConfig), [detail.data, serverConfig]);
  const record = asRecord(detail.data);
  const resolvedCode = video.code || code;
  const movieId = pickString(record, ['video_id', 'movie_id', 'id']) || resolvedCode;

  const history = useQuery({
    queryKey: ['download-history', resolvedCode],
    queryFn: () => api.getVideoDownloadHistory(resolvedCode),
    enabled: !!resolvedCode,
  });
  const userScore = useQuery({
    queryKey: ['user-score', resolvedCode],
    queryFn: () => api.getUserScore(resolvedCode),
    enabled: !!resolvedCode,
  });
  const subscriptionStatus = useQuery({
    queryKey: ['subscription-status', resolvedCode],
    queryFn: () => api.batchCheckSubscriptionStatus([resolvedCode]),
    enabled: !!resolvedCode,
  });
  const downloaders = useQuery({
    queryKey: ['downloaders'],
    queryFn: () => api.getDownloaders(),
  });
  const customMagnets = useQuery({
    queryKey: ['custom-magnets', resolvedCode],
    queryFn: () => api.getCustomMagnets(resolvedCode),
    enabled: !!resolvedCode,
  });
  const nyaaMagnets = useQuery({
    queryKey: ['nyaa-magnets', resolvedCode],
    queryFn: () => api.getNyaaMagnets(resolvedCode),
    enabled: !!resolvedCode,
  });
  const localSubtitles = useQuery({
    queryKey: ['subtitles', resolvedCode],
    queryFn: () => api.findSubtitle(resolvedCode),
    enabled: !!resolvedCode,
  });
  const externalSubtitles = useQuery({
    queryKey: ['external-subtitles', resolvedCode],
    queryFn: () => api.searchExternalSubtitle(resolvedCode),
    enabled: false,
  });
  const relatedLists = useQuery({
    queryKey: ['related-lists', movieId],
    queryFn: () => api.getRelatedLists(movieId, 1, 12),
    enabled: !!movieId,
  });
  const selectedUserId = selectedUser?.id || '';
  const userResources = useQuery({
    queryKey: ['review-user-resources', selectedUserId, selectedUser?.username || ''],
    queryFn: () =>
      api.getUserReviewResources(selectedUserId, {
        page: 1,
        limit: 12,
        username: selectedUser?.username || '',
      }),
    enabled: !!selectedUserId,
  });
  const userResourceItems = extractNestedList<ResourceRecord>(userResources.data, ['items', 'resources', 'results']);
  const userResourceMetadata = useQuery({
    queryKey: ['review-user-resource-metadata', selectedUserId, userResourceItems],
    queryFn: () => api.getUserReviewResourceMetadata(userResourceItems as JsonRecord[]),
    enabled: !!selectedUserId && userResourceItems.length > 0,
  });
  const stream = useQuery({
    queryKey: ['library-stream', resolvedCode],
    queryFn: () => api.getLibraryStream(resolvedCode),
    enabled: false,
  });

  useEffect(() => {
    const scoreRecord = asRecord(userScore.data);
    const data = asRecord(scoreRecord.data);
    const nextScore =
      pickNumber(data, ['user_score', 'score']) ??
      pickNumber(scoreRecord, ['user_score', 'score']) ??
      video.user_score;
    if (nextScore !== undefined && nextScore !== null) {
      setScore(clampScore(nextScore));
    }
  }, [userScore.data, video.user_score]);

  const streamRecord = asRecord(stream.data);
  const streamUrl =
    pickString(streamRecord, ['stream_url', 'streamUrl', 'url', 'play_url']) ||
    pickString(asRecord(streamRecord.stream), ['stream_url', 'url']);

  const actors = useMemo(() => extractEntityItems(record.actors), [record.actors]);
  const categories = useMemo(() => extractEntityItems(record.categories), [record.categories]);
  const previews = useMemo(() => extractImages(record, serverConfig), [record, serverConfig]);
  const relativeMovies = useMemo(
    () => normalizeVideoItems(record.relative_movies, serverConfig),
    [record.relative_movies, serverConfig],
  );
  const actorMovies = useMemo(
    () => normalizeVideoItems(record.actor_movies, serverConfig),
    [record.actor_movies, serverConfig],
  );
  const downloaderItems = extractNestedList<ResourceRecord>(downloaders.data, ['downloaders', 'items', 'data']);
  const internalMagnets = extractNestedList<ResourceRecord>(record.magnets, ['magnets', 'items']);
  const externalCustomMagnets = extractNestedList<ResourceRecord>(customMagnets.data, ['magnets', 'items', 'results']);
  const externalNyaaMagnets = extractNestedList<ResourceRecord>(nyaaMagnets.data, ['magnets', 'items', 'results']);
  const magnets = mergeResources('magnet', externalCustomMagnets, internalMagnets, externalNyaaMagnets);
  const ed2ks = extractNestedList<ResourceRecord>(record.ed2ks, ['ed2ks', 'items']).sort(
    (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.size_mb || 0) - Number(a.size_mb || 0),
  );
  const localSubtitleItems = extractNestedList<ResourceRecord>(localSubtitles.data, ['files', 'items', 'subtitles']);
  const externalSubtitleItems = extractNestedList<ResourceRecord>(externalSubtitles.data, ['items', 'files', 'subtitles']);
  const relatedListItems = extractNestedList<ResourceRecord>(relatedLists.data, ['lists', 'items', 'results']);
  const isSubscribed = resolveSubscriptionState(record, subscriptionStatus.data, resolvedCode);

  const openVideo = (item: VideoSummary) => {
    navigation.push('VideoDetail', {code: item.code || item.id || ''});
  };

  const play = async () => {
    try {
      const result = await stream.refetch();
      const nextRecord = asRecord(result.data);
      const nextUrl =
        pickString(nextRecord, ['stream_url', 'streamUrl', 'url', 'play_url']) ||
        pickString(asRecord(nextRecord.stream), ['stream_url', 'url']);
      if (!nextUrl) {
        Alert.alert('播放不可用', '后端未返回可播放地址');
        return;
      }
      navigation.navigate('Player', {
        code: resolvedCode,
        title: video.title || resolvedCode,
        streamUrl: absoluteUrl(serverConfig, nextUrl),
      });
    } catch (error) {
      Alert.alert('播放失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const submitScore = async () => {
    try {
      await api.setUserScore(resolvedCode, Number(score));
      Alert.alert('评分', '评分已保存');
      await Promise.all([userScore.refetch(), detail.refetch()]);
    } catch (error) {
      Alert.alert('评分失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const toggleSubscription = async () => {
    try {
      if (isSubscribed) {
        await api.deleteSubscription(resolvedCode);
      } else {
        await api.createSubscription({
          code: resolvedCode,
          title: video.title || resolvedCode,
          cover: video.cover || video.cover_url || '',
        });
      }
      await Promise.all([subscriptionStatus.refetch(), detail.refetch()]);
      Alert.alert('订阅', isSubscribed ? '已取消订阅' : '已加入订阅');
    } catch (error) {
      Alert.alert('订阅失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const forceRefresh = () => setRefreshNonce(value => value + 1);

  const recheck = () => {
    Alert.alert('重新检查', '提交后会由后端重新检查当前影片资源。', [
      {text: '取消', style: 'cancel'},
      {
        text: '提交',
        onPress: () => {
          void (async () => {
            try {
              await api.recheckVideos({codes: [resolvedCode]});
              Alert.alert('任务已提交', '请在下载任务/调度状态中查看进度');
              await detail.refetch();
            } catch (error) {
              Alert.alert('提交失败', error instanceof Error ? error.message : '请求失败');
            }
          })();
        },
      },
    ]);
  };

  const shareResource = async (url: string) => {
    if (!url) {
      Alert.alert('资源不可用', '当前资源没有可用链接');
      return;
    }
    await Share.share({message: url});
  };

  const pushResource = async (resource: ResourceRecord, kind: ResourceKind) => {
    const url = resourceUrl(resource, kind);
    if (!url) {
      Alert.alert('资源不可用', '当前资源没有可推送链接');
      return;
    }

    const downloader = downloaderItems.find(item =>
      kind === 'ed2k' ? item.ed2k_enabled !== false : item.magnet_enabled !== false,
    );
    const downloaderName = downloader ? pickString(downloader, ['name', 'id']) : '';

    try {
      await api.downloadLegacy(
        [url],
        downloaderName,
        '',
        detail.data as JsonRecord,
        [resource as JsonRecord],
      );
      Alert.alert('下载任务', downloaderName ? `已推送到 ${downloaderName}` : '已提交给默认下载器');
      await history.refetch();
    } catch (error) {
      Alert.alert('推送失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const openUserResources = (resource: ResourceRecord) => {
    const id = pickString(resource, ['source_user_id', 'user_id']);
    if (!id) {
      return;
    }
    setSelectedUser({
      id,
      username: pickString(resource, ['source_username', 'username']),
    });
  };

  const previewSubtitle = async (item: ResourceRecord, external = false) => {
    try {
      const result = external
        ? await api.previewExternalSubtitle(pickString(item, ['url', 'download_url', 'link']))
        : await api.previewSubtitle(pickString(item, ['id', 'file_id', 'path']));
      Alert.alert('字幕预览', summarizeRecord(result).slice(0, 900));
    } catch (error) {
      Alert.alert('预览失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const openSubtitleDownload = (item: ResourceRecord, external = false) => {
    const url = external
      ? apiFileUrl(
          serverConfig,
          `subtitle/external/download?url=${encodeURIComponent(
            pickString(item, ['url', 'download_url', 'link']),
          )}&name=${encodeURIComponent(pickString(item, ['name', 'title']) || resolvedCode)}&ext=${encodeURIComponent(
            pickString(item, ['ext', 'extension']) || 'srt',
          )}`,
        )
      : apiFileUrl(
          serverConfig,
          `subtitle/download?id=${encodeURIComponent(pickString(item, ['id', 'file_id', 'path']))}`,
        );
    Linking.openURL(url).catch(error => Alert.alert('打开失败', error.message));
  };

  if (detail.isLoading) {
    return <LoadingState />;
  }

  if (detail.error) {
    return <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />;
  }

  return (
    <Screen>
      <Card
        action={
          <TextButton label={detail.isFetching ? '刷新中' : '强制刷新'} onPress={forceRefresh} />
        }>
        <View style={styles.heroRow}>
          <VideoThumb uri={video.cover || video.cover_url} />
          <View style={styles.heroBody}>
            <Text style={{color: colors.text, fontSize: 20, fontWeight: '800', lineHeight: 26}}>
              {video.title || resolvedCode}
            </Text>
            <Text style={{color: colors.mutedText}}>
              {[resolvedCode, video.release_date].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.badgeRow}>
              {typeof video.score === 'number' ? <Badge label={`评分 ${video.score}`} /> : null}
              {isSubscribed ? <Badge label="已订阅" tone="success" /> : null}
            </View>
            <PrimaryButton label={stream.isFetching ? '解析中' : '播放'} onPress={play} disabled={stream.isFetching} />
          </View>
        </View>
        <View style={styles.actionGrid}>
          <PrimaryButton label={isSubscribed ? '取消订阅' : '订阅'} onPress={toggleSubscription} tone="neutral" />
          <PrimaryButton label="重新检查" onPress={recheck} tone="neutral" />
        </View>
      </Card>

      <Card title="评分">
        <SegmentedControl
          value={score}
          onChange={setScore}
          options={scoreOptions.map(value => ({label: value, value}))}
        />
        <PrimaryButton label="保存评分" onPress={submitScore} tone="neutral" />
      </Card>

      <Card title="详情">
        {Object.entries(record)
          .filter(([key, value]) => !hiddenDetailKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
          .slice(0, 18)
          .map(([key, value]) => (
            <KeyValueRow key={key} label={key} value={String(value)} />
          ))}
      </Card>

      <EntityChips
        title="演员"
        items={actors}
        onPress={item => navigation.navigate('Filter', {type: 'actor', id: item.id, value: item.label})}
      />
      <EntityChips
        title="类别"
        items={categories}
        onPress={item => navigation.navigate('Filter', {type: 'category', id: item.id, value: item.label})}
      />

      <PreviewStrip images={previews} />
      <VideoRail title="相似影片" items={relativeMovies} onPress={openVideo} />
      <VideoRail title="演员相关" items={actorMovies} onPress={openVideo} />

      <ResourceSection
        title="磁链"
        kind="magnet"
        resources={magnets}
        loading={customMagnets.isFetching || nyaaMagnets.isFetching}
        onShare={shareResource}
        onPush={pushResource}
        onOpenUser={openUserResources}
      />
      <ResourceSection
        title="ed2k"
        kind="ed2k"
        resources={ed2ks}
        onShare={shareResource}
        onPush={pushResource}
        onOpenUser={openUserResources}
      />

      <Card
        title="字幕"
        action={
          <TextButton
            label={externalSubtitles.isFetching ? '搜索中' : '搜索外部'}
            onPress={() => {
              void externalSubtitles.refetch();
            }}
          />
        }>
        {localSubtitles.isLoading ? <LoadingState label="字幕加载中" /> : null}
        {!localSubtitles.isLoading && !localSubtitleItems.length && !externalSubtitleItems.length ? (
          <EmptyState label="暂无字幕" />
        ) : null}
        {localSubtitleItems.map((item, index) => (
          <View key={`local-${index}`} style={[styles.resourceRow, {borderBottomColor: colors.border}]}>
            <Text style={[styles.resourceTitle, {color: colors.text}]}>
              {pickString(item, ['name', 'filename', 'path', 'id']) || `本地字幕 ${index + 1}`}
            </Text>
            <View style={styles.actionRow}>
              <TextButton label="预览" onPress={() => previewSubtitle(item)} />
              <TextButton label="下载" onPress={() => openSubtitleDownload(item)} />
            </View>
          </View>
        ))}
        {externalSubtitleItems.map((item, index) => (
          <View key={`external-${index}`} style={[styles.resourceRow, {borderBottomColor: colors.border}]}>
            <Text style={[styles.resourceTitle, {color: colors.text}]}>
              {pickString(item, ['name', 'title', 'filename']) || `外部字幕 ${index + 1}`}
            </Text>
            <Text style={[styles.resourceMeta, {color: colors.mutedText}]}>{pickString(item, ['site', 'lang', 'ext'])}</Text>
            <View style={styles.actionRow}>
              <TextButton label="预览" onPress={() => previewSubtitle(item, true)} />
              <TextButton label="下载" onPress={() => openSubtitleDownload(item, true)} />
            </View>
          </View>
        ))}
      </Card>

      <Card title="相关清单">
        {relatedLists.isLoading ? <LoadingState /> : <JsonRows items={relatedListItems} />}
      </Card>

      {selectedUser ? (
        <Card title={`${selectedUser.username || selectedUser.id} 的资源`}>
          {userResources.isLoading ? <LoadingState /> : <JsonRows items={userResourceItems} />}
          {userResourceMetadata.data ? (
            <Text style={{color: colors.mutedText, lineHeight: 22}}>
              {summarizeRecord(userResourceMetadata.data)}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card title="下载历史">
        {history.isLoading ? (
          <LoadingState />
        ) : (
          <Text style={{color: colors.text, lineHeight: 22}}>{summarizeRecord(history.data)}</Text>
        )}
      </Card>

      {streamUrl ? (
        <Card title="播放地址">
          <Text style={{color: colors.mutedText}}>{absoluteUrl(serverConfig, streamUrl)}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  heroBody: {
    flex: 1,
    gap: spacing.sm,
  },
  heroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewImage: {
    aspectRatio: 16 / 9,
    borderRadius: radius.sm,
    width: 168,
  },
  previewIndex: {
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  previewStrip: {
    gap: spacing.md,
  },
  resourceMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  resourceRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  resourceTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  videoRail: {
    gap: spacing.md,
  },
  videoRailItem: {
    gap: spacing.sm,
    width: 112,
  },
  videoRailMeta: {
    fontSize: 12,
  },
  videoRailTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
});
