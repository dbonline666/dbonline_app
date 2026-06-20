import React, {ReactNode, useEffect, useMemo, useState} from 'react';
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
import {
  Captions,
  Download,
  ExternalLink,
  Heart,
  Info,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  Star as StarIcon,
  Tags,
  Users,
} from 'lucide-react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TextButton,
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
type IconComponent = React.ComponentType<{color?: string; size?: number; strokeWidth?: number}>;
type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

const scoreOptions: ScoreValue[] = ['0', '1', '2', '3', '4', '5'];

const hiddenDetailKeys = new Set([
  'actors',
  'actor_movies',
  'categories',
  'cover',
  'cover_url',
  'director',
  'ed2ks',
  'library',
  'maker',
  'magnets',
  'overview',
  'preview_images',
  'previews',
  'publisher',
  'relative_movies',
  'samples',
  'series',
  'thumb_url',
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
        id: pickString(record, ['external_id', 'id', 'actor_id', 'category_id']),
        label: pickString(record, ['name', 'title', 'label']),
      };
    })
    .filter(item => item.label || item.id);

const extractNamedEntity = (record: ResourceRecord, key: string) => {
  const entity = asRecord(record[key]);
  return {
    id: pickString(entity, ['external_id', 'id', `${key}_id`]),
    label: pickString(entity, ['name', 'title', 'label']),
  };
};

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

const toneColor = (colors: ReturnType<typeof useAppColors>, tone: Tone) => {
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  if (tone === 'danger') return colors.danger;
  if (tone === 'secondary') return colors.secondary;
  if (tone === 'neutral') return colors.secondaryText;
  return colors.primary;
};

const toneBackground = (colors: ReturnType<typeof useAppColors>, tone: Tone) => {
  if (tone === 'success') return colors.successSoft;
  if (tone === 'warning') return colors.warningSoft;
  if (tone === 'danger') return colors.accentSoft;
  if (tone === 'secondary') return colors.secondarySoft;
  if (tone === 'neutral') return colors.chipBg;
  return colors.primarySoft;
};

function DetailBadge({label, tone = 'neutral'}: {label: string; tone?: Tone}) {
  const colors = useAppColors();
  const color = toneColor(colors, tone);
  return (
    <View style={[styles.detailBadge, {backgroundColor: toneBackground(colors, tone), borderColor: color}]}>
      <Text style={[styles.detailBadgeText, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function IconAction({
  icon: Icon,
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  const color = toneColor(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.iconAction,
        {
          backgroundColor: pressed ? toneBackground(colors, tone) : 'rgba(255, 255, 255, 0.03)',
          borderColor: disabled ? colors.panelBorder : color,
          opacity: disabled ? 0.5 : 1,
          shadowColor: color,
        },
      ]}>
      <Icon color={color} size={17} strokeWidth={2.2} />
      <Text style={[styles.iconActionText, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HeroCover({
  uri,
  title,
  onPlay,
  disabled,
}: {
  uri?: string;
  title: string;
  onPlay: () => void;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.coverPanel, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      {uri ? (
        <Image source={{uri}} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <View style={styles.coverFallback}>
          <Text style={[styles.coverFallbackEyebrow, {color: colors.primary}]}>COVER</Text>
          <Text style={[styles.coverFallbackTitle, {color: colors.mutedText}]} numberOfLines={2}>
            {title || 'No cover'}
          </Text>
        </View>
      )}
      <View style={styles.coverShade} />
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPlay}
        style={({pressed}) => [
          styles.playButton,
          {
            backgroundColor: pressed ? colors.primarySoft : 'rgba(0, 0, 0, 0.58)',
            borderColor: colors.primary,
            opacity: disabled ? 0.55 : 1,
            shadowColor: colors.primary,
          },
        ]}>
        <Play color={colors.primary} size={28} />
      </Pressable>
    </View>
  );
}

function ScoreStars({score}: {score?: number}) {
  const colors = useAppColors();
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.min(5, Number(score))) : 0;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(index => (
        <StarIcon
          key={index}
          color={index <= Math.round(safeScore) ? colors.warning : colors.panelBorder}
          size={16}
        />
      ))}
      <Text style={[styles.starText, {color: colors.warning}]}>
        {safeScore ? safeScore.toFixed(1) : '---'}
      </Text>
    </View>
  );
}

function InfoLine({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const colors = useAppColors();
  if (!value) {
    return null;
  }

  const content = (
    <View style={[styles.infoLine, {borderBottomColor: colors.panelBorder}]}>
      <Text style={[styles.infoLabel, {color: colors.mutedText}]}>{label}</Text>
      <Text style={[styles.infoValue, {color: onPress ? colors.primary : colors.text}]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function EntityChips({
  title,
  icon,
  items,
  onPress,
}: {
  title: string;
  icon: ReactNode;
  items: {id: string; label: string}[];
  onPress: (item: {id: string; label: string}) => void;
}) {
  const colors = useAppColors();
  if (!items.length) {
    return null;
  }

  return (
    <Card
      variant="strong"
      title={title}
      action={icon}>
      <View style={styles.chipWrap}>
        {items.map((item, index) => (
          <Pressable
            key={`${item.id}-${item.label}-${index}`}
            onPress={() => onPress(item)}
            style={({pressed}) => [
              styles.entityChip,
              {
                backgroundColor: pressed ? colors.primarySoft : colors.chipBg,
                borderColor: pressed ? colors.primary : colors.panelBorder,
              },
            ]}>
            <Text style={[styles.entityChipText, {color: colors.text}]} numberOfLines={1}>
              {item.label || item.id}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function PreviewStrip({images}: {images: string[]}) {
  const colors = useAppColors();
  if (!images.length) {
    return null;
  }

  return (
    <Card variant="strong" title={`预览图 (${images.length})`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewStrip}>
        {images.map((image, index) => (
          <Pressable key={`${image}-${index}`} onPress={() => Linking.openURL(image)} style={styles.previewItem}>
            <Image source={{uri: image}} style={[styles.previewImage, {backgroundColor: colors.inputBg}]} />
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
    <Card variant="strong" title={`${title} (${items.length})`}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoRail}>
        {items.slice(0, 20).map((item, index) => {
          const cover = typeof item.cover === 'string' ? item.cover : typeof item.cover_url === 'string' ? item.cover_url : '';
          return (
            <Pressable
              key={item.id || item.code || String(index)}
              onPress={() => onPress(item)}
              style={({pressed}) => [
                styles.videoRailItem,
                {
                  backgroundColor: colors.panel,
                  borderColor: colors.panelBorder,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}>
              {cover ? (
                <Image source={{uri: cover}} style={styles.videoRailImage} resizeMode="cover" />
              ) : (
                <View style={[styles.videoRailImage, styles.videoRailFallback, {backgroundColor: colors.inputBg}]}>
                  <Text style={{color: colors.mutedText, fontSize: 10, fontWeight: '800'}}>NO IMG</Text>
                </View>
              )}
              <View style={styles.videoRailBody}>
                <Text style={[styles.videoRailTitle, {color: colors.text}]} numberOfLines={2}>
                  {item.title || item.code || item.id}
                </Text>
                <Text style={[styles.videoRailMeta, {color: colors.code}]} numberOfLines={1}>
                  {item.code || item.release_date || item.date}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Card>
  );
}

function ResourceSection({
  title,
  icon,
  kind,
  resources,
  loading,
  onShare,
  onPush,
  onOpenUser,
}: {
  title: string;
  icon: ReactNode;
  kind: ResourceKind;
  resources: ResourceRecord[];
  loading?: boolean;
  onShare: (url: string) => void;
  onPush: (resource: ResourceRecord, kind: ResourceKind) => void;
  onOpenUser: (resource: ResourceRecord) => void;
}) {
  const colors = useAppColors();

  return (
    <Card variant="cyber" title={`${title} (${resources.length})`} action={icon}>
      {loading ? <LoadingState label="资源加载中" /> : null}
      {!loading && !resources.length ? <EmptyState label="暂无资源" /> : null}
      {resources.map((resource, index) => {
        const url = resourceUrl(resource, kind);
        const hasUrl = Boolean(url);
        const sourceUserId = pickString(resource, ['source_user_id', 'user_id']);
        const sourceUsername = pickString(resource, ['source_username', 'username']);
        return (
          <View
            key={`${url}-${index}`}
            style={[styles.resourceCard, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
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
            <View style={styles.resourceActions}>
              <MiniAction icon={Share2} label="分享" onPress={() => onShare(url)} tone="primary" disabled={!hasUrl} />
              <MiniAction icon={Download} label="推送" onPress={() => onPush(resource, kind)} tone="secondary" disabled={!hasUrl} />
              {sourceUserId ? (
                <MiniAction
                  icon={ExternalLink}
                  label={sourceUsername || '用户资源'}
                  onPress={() => onOpenUser(resource)}
                  tone="neutral"
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function MiniAction({
  icon: Icon,
  label,
  onPress,
  tone = 'primary',
  disabled,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
  tone?: Tone;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  const color = toneColor(colors, tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.miniAction,
        {
          borderColor: disabled ? colors.panelBorder : color,
          backgroundColor: toneBackground(colors, tone),
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      <Icon color={color} size={13} strokeWidth={2.2} />
      <Text style={[styles.miniActionText, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
        <View key={String(item.id || item.code || index)} style={[styles.jsonRow, {borderBottomColor: colors.panelBorder}]}>
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
  const library = asRecord(record.library);
  const libraryStatus = {
    inLibrary: Boolean(library.in_library),
    source: pickString(library, ['source']),
    name: pickString(library, ['name']),
    url: pickString(library, ['url']),
  };
  const director = extractNamedEntity(record, 'director');
  const maker = extractNamedEntity(record, 'maker');
  const publisher = extractNamedEntity(record, 'publisher');
  const series = extractNamedEntity(record, 'series');
  const overview = pickString(record, ['overview', 'description', 'summary']);
  const videoScore = pickNumber(record, ['score', 'rating']) ?? video.score;
  const duration = pickNumber(record, ['duration', 'runtime']);
  const cover = absoluteUrl(
    serverConfig,
    String(video.cover || video.cover_url || pickString(record, ['cover_url', 'thumb_url', 'poster'])),
  );
  const canPlay = libraryStatus.inLibrary;

  const openVideo = (item: VideoSummary) => {
    navigation.push('VideoDetail', {code: item.code || item.id || ''});
  };

  const play = async () => {
    if (!canPlay) {
      Alert.alert('播放不可用', '当前影片尚未入库，无法从媒体库解析播放地址');
      return;
    }

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
    const target = external
      ? pickString(item, ['url', 'download_url', 'link'])
      : pickString(item, ['id', 'file_id', 'path']);
    if (!target) {
      Alert.alert('字幕不可用', '当前字幕缺少可预览的地址或 ID');
      return;
    }

    try {
      const result = external
        ? await api.previewExternalSubtitle(target)
        : await api.previewSubtitle(target);
      Alert.alert('字幕预览', summarizeRecord(result).slice(0, 900));
    } catch (error) {
      Alert.alert('预览失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const openSubtitleDownload = (item: ResourceRecord, external = false) => {
    const target = external
      ? pickString(item, ['url', 'download_url', 'link'])
      : pickString(item, ['id', 'file_id', 'path']);
    if (!target) {
      Alert.alert('字幕不可用', '当前字幕缺少可下载的地址或 ID');
      return;
    }

    const url = external
      ? apiFileUrl(
          serverConfig,
          `subtitle/external/download?url=${encodeURIComponent(
            target,
          )}&name=${encodeURIComponent(pickString(item, ['name', 'title']) || resolvedCode)}&ext=${encodeURIComponent(
            pickString(item, ['ext', 'extension']) || 'srt',
          )}`,
        )
      : apiFileUrl(
          serverConfig,
          `subtitle/download?id=${encodeURIComponent(target)}`,
        );
    Linking.openURL(url).catch(error => Alert.alert('打开失败', error.message));
  };

  const openEntity = (
    entity: RootStackParamList['EntityMovies']['entity'],
    item: {id: string; label: string},
  ) => {
    if (!item.id) {
      return;
    }
    navigation.navigate('EntityMovies', {entity, id: item.id, title: item.label});
  };

  const openLibrary = () => {
    if (!libraryStatus.url) {
      return;
    }
    Linking.openURL(absoluteUrl(serverConfig, libraryStatus.url)).catch(error => Alert.alert('打开失败', error.message));
  };

  if (detail.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (detail.error) {
    return (
      <Screen>
        <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card
        variant="cyber"
        action={<TextButton label={detail.isFetching ? '刷新中' : '强制刷新'} onPress={forceRefresh} />}>
        <View style={styles.detailHeader}>
          <Text style={[styles.eyebrow, {color: colors.secondary}]}>VIDEO DETAIL</Text>
          <Text style={[styles.detailTitle, {color: colors.text}]}>{video.title || resolvedCode}</Text>
          <View style={styles.badgeRow}>
            <DetailBadge label={resolvedCode} tone="secondary" />
            {video.release_date || video.date ? <DetailBadge label={String(video.release_date || video.date)} tone="neutral" /> : null}
            {duration ? <DetailBadge label={`${duration} 分钟`} tone="neutral" /> : null}
            {libraryStatus.inLibrary ? (
              <DetailBadge label={`已入库 ${libraryStatus.source || libraryStatus.name || '媒体库'}`} tone="success" />
            ) : null}
            {isSubscribed ? <DetailBadge label="已订阅" tone="warning" /> : null}
          </View>
        </View>

        <HeroCover uri={cover} title={video.title || resolvedCode} onPlay={play} disabled={stream.isFetching || !canPlay} />

        <View style={styles.heroActions}>
          <IconAction icon={Play} label={!canPlay ? '未入库' : stream.isFetching ? '解析中' : '播放'} onPress={play} disabled={stream.isFetching || !canPlay} />
          <IconAction icon={Heart} label={isSubscribed ? '取消订阅' : '订阅'} onPress={toggleSubscription} tone={isSubscribed ? 'danger' : 'secondary'} />
          <IconAction icon={RotateCcw} label="重新检查" onPress={recheck} tone="neutral" />
          <IconAction icon={RefreshCw} label="刷新" onPress={forceRefresh} tone="neutral" />
          {libraryStatus.inLibrary && libraryStatus.url ? (
            <IconAction icon={ExternalLink} label="媒体库" onPress={openLibrary} tone="success" />
          ) : null}
        </View>
      </Card>

      <Card variant="strong" title="影片信息" action={<Info color={colors.primary} size={18} />}>
        <InfoLine label="导演" value={director.label} onPress={() => openEntity('directors', director)} />
        <InfoLine label="制作商" value={maker.label} onPress={() => openEntity('makers', maker)} />
        <InfoLine label="发行商" value={publisher.label} onPress={() => openEntity('publishers', publisher)} />
        <InfoLine label="系列" value={series.label} onPress={() => openEntity('series', series)} />
        <InfoLine label="发行日期" value={String(video.release_date || video.date || '')} />
        <View style={[styles.infoLine, {borderBottomColor: colors.panelBorder}]}>
          <Text style={[styles.infoLabel, {color: colors.mutedText}]}>评分</Text>
          <ScoreStars score={videoScore} />
        </View>
        {overview ? (
          <Text style={[styles.overview, {color: colors.secondaryText}]}>{overview}</Text>
        ) : null}
      </Card>

      <Card variant="strong" title="我的评分" action={<StarIcon color={colors.warning} size={18} />}>
        <SegmentedControl
          value={score}
          onChange={setScore}
          options={scoreOptions.map(value => ({label: value, value}))}
        />
        <PrimaryButton label="保存评分" onPress={submitScore} tone="warning" />
      </Card>

      <EntityChips
        title="演员"
        icon={<Users color={colors.primary} size={18} />}
        items={actors}
        onPress={item => navigation.navigate('Filter', {type: 'actor', id: item.id, value: item.label})}
      />
      <EntityChips
        title="类别"
        icon={<Tags color={colors.secondary} size={18} />}
        items={categories}
        onPress={item => navigation.navigate('Filter', {type: 'category', id: item.id, value: item.label})}
      />

      <PreviewStrip images={previews} />
      <VideoRail title="演员相关" items={actorMovies} onPress={openVideo} />
      <VideoRail title="相似影片" items={relativeMovies} onPress={openVideo} />

      <ResourceSection
        title="磁链"
        icon={<Download color={colors.primary} size={18} />}
        kind="magnet"
        resources={magnets}
        loading={customMagnets.isFetching || nyaaMagnets.isFetching}
        onShare={shareResource}
        onPush={pushResource}
        onOpenUser={openUserResources}
      />
      <ResourceSection
        title="ed2k"
        icon={<Download color={colors.secondary} size={18} />}
        kind="ed2k"
        resources={ed2ks}
        onShare={shareResource}
        onPush={pushResource}
        onOpenUser={openUserResources}
      />

      <Card
        variant="cyber"
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
          <SubtitleRow
            key={`local-${index}`}
            item={item}
            title={pickString(item, ['name', 'filename', 'path', 'id']) || `本地字幕 ${index + 1}`}
            onPreview={() => previewSubtitle(item)}
            onDownload={() => openSubtitleDownload(item)}
          />
        ))}
        {externalSubtitleItems.map((item, index) => (
          <SubtitleRow
            key={`external-${index}`}
            item={item}
            title={pickString(item, ['name', 'title', 'filename']) || `外部字幕 ${index + 1}`}
            onPreview={() => previewSubtitle(item, true)}
            onDownload={() => openSubtitleDownload(item, true)}
          />
        ))}
      </Card>

      <Card variant="strong" title="相关清单">
        {relatedLists.isLoading ? <LoadingState /> : <JsonRows items={relatedListItems} />}
      </Card>

      {selectedUser ? (
        <Card variant="strong" title={`${selectedUser.username || selectedUser.id} 的资源`}>
          {userResources.isLoading ? <LoadingState /> : <JsonRows items={userResourceItems} />}
          {userResourceMetadata.data ? (
            <Text style={[styles.resourceMeta, {color: colors.mutedText}]}>
              {summarizeRecord(userResourceMetadata.data)}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card variant="strong" title="原始字段">
        {Object.entries(record)
          .filter(([key, value]) => !hiddenDetailKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
          .slice(0, 18)
          .map(([key, value]) => (
            <InfoLine key={key} label={key} value={String(value)} />
          ))}
      </Card>

      <Card variant="strong" title="下载历史">
        {history.isLoading ? (
          <LoadingState />
        ) : (
          <Text style={[styles.resourceMeta, {color: colors.secondaryText}]}>{summarizeRecord(history.data)}</Text>
        )}
      </Card>

      {streamUrl ? (
        <Card variant="strong" title="播放地址">
          <Text style={[styles.resourceMeta, {color: colors.mutedText}]}>{absoluteUrl(serverConfig, streamUrl)}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function SubtitleRow({
  title,
  item,
  onPreview,
  onDownload,
}: {
  title: string;
  item: ResourceRecord;
  onPreview: () => void;
  onDownload: () => void;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.resourceCard, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      <View style={styles.subtitleTitleRow}>
        <Captions color={colors.primary} size={16} />
        <Text style={[styles.resourceTitle, {color: colors.text}]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text style={[styles.resourceMeta, {color: colors.mutedText}]} numberOfLines={1}>
        {[pickString(item, ['site', 'source']), pickString(item, ['lang', 'language']), pickString(item, ['ext', 'extension'])]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={styles.resourceActions}>
        <MiniAction icon={ExternalLink} label="预览" onPress={onPreview} tone="primary" />
        <MiniAction icon={Download} label="下载" onPress={onDownload} tone="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailHeader: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  detailTitle: {
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detailBadge: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  detailBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  coverPanel: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    height: '100%',
    width: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    padding: spacing.lg,
    width: '100%',
  },
  coverFallbackEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  coverFallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  coverShade: {
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  playButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -32,
    marginTop: -32,
    position: 'absolute',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.55,
    shadowRadius: 18,
    top: '50%',
    width: 64,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconAction: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: '47%',
    paddingHorizontal: spacing.md,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
  iconActionText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '900',
  },
  infoLine: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 42,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  infoValue: {
    flex: 1.35,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'right',
  },
  starRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'flex-end',
  },
  starText: {
    fontSize: 13,
    fontWeight: '900',
    marginLeft: spacing.xs,
  },
  overview: {
    fontSize: 14,
    lineHeight: 22,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  entityChip: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  entityChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  previewStrip: {
    gap: spacing.md,
  },
  previewItem: {
    width: 190,
  },
  previewImage: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    width: '100%',
  },
  previewIndex: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  videoRail: {
    gap: spacing.md,
  },
  videoRailItem: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: 126,
  },
  videoRailImage: {
    aspectRatio: 0.72,
    width: '100%',
  },
  videoRailFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoRailBody: {
    gap: 3,
    padding: spacing.sm,
  },
  videoRailTitle: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  videoRailMeta: {
    fontSize: 10,
    fontWeight: '800',
  },
  resourceCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resourceTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  resourceMeta: {
    fontSize: 12,
    lineHeight: 19,
  },
  resourceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniAction: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  miniActionText: {
    fontSize: 11,
    fontWeight: '900',
  },
  jsonRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  subtitleTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
