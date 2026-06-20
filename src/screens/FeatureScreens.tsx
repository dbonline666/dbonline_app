import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  Download,
  ListOrdered,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  TextButton,
  useAppColors,
} from '../components/ui';
import {VideoList} from '../components/VideoList';
import {useAppState} from '../state/AppState';
import type {RootStackParamList} from '../navigation/types';
import {extractList} from '../services/api/endpoints';
import {normalizeVideo, summarizeRecord} from '../utils/data';
import type {JsonRecord, VideoSummary} from '../types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

type JsonAction = {
  key: string;
  label: string;
  initialJson?: string;
  tone?: 'neutral' | 'danger';
  run: (payload: JsonRecord) => Promise<unknown>;
};

const parsePayload = (value: string): JsonRecord => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as JsonRecord)
    : {};
};

const field = (payload: JsonRecord, keys: string[]) => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number') {
      return String(value);
    }
  }
  throw new Error(`缺少字段：${keys[0]}`);
};

const stringArray = (payload: JsonRecord, key: string) => {
  const value = payload[key];
  return Array.isArray(value)
    ? value.map(item => String(item).trim()).filter(Boolean)
    : [];
};

const numberValue = (payload: JsonRecord, key: string) => {
  const value = payload[key];
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return 0;
};

const subscriptionVideoOptions = (payload: JsonRecord) => ({
  status: typeof payload.status === 'string' ? payload.status : '',
  page: numberValue(payload, 'page'),
  limit: numberValue(payload, 'limit'),
});

const withoutKeys = (payload: JsonRecord, keys: string[]) => {
  const next: JsonRecord = {...payload};
  keys.forEach(key => {
    delete next[key];
  });
  return next;
};

function JsonActionPanel({
  title,
  actions,
  onDone,
}: {
  title: string;
  actions: JsonAction[];
  onDone?: () => Promise<unknown> | void;
}) {
  const [selectedKey, setSelectedKey] = useState(actions[0]?.key || '');
  const [payloadJson, setPayloadJson] = useState(actions[0]?.initialJson || '{}');
  const selected = actions.find(action => action.key === selectedKey) || actions[0];

  useEffect(() => {
    const first = actions[0];
    setSelectedKey(first?.key || '');
    setPayloadJson(first?.initialJson || '{}');
  }, [actions]);

  const runSelected = async () => {
    if (!selected) {
      return;
    }
    try {
      const result = await selected.run(parsePayload(payloadJson));
      Alert.alert('执行结果', summarizeRecord(result));
      await onDone?.();
    } catch (error) {
      Alert.alert('执行失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  if (!actions.length) {
    return null;
  }

  return (
    <Card title={title}>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 14}}>
        {actions.map(action => (
          <TextButton
            key={action.key}
            label={action.label}
            onPress={() => {
              setSelectedKey(action.key);
              setPayloadJson(action.initialJson || '{}');
            }}
          />
        ))}
      </View>
      <Field
        label={selected ? `${selected.label} 参数 JSON` : '参数 JSON'}
        value={payloadJson}
        onChangeText={setPayloadJson}
        multiline
      />
      {selected ? (
        <PrimaryButton
          label={`执行：${selected.label}`}
          onPress={runSelected}
          tone={selected.tone || 'neutral'}
        />
      ) : null}
    </Card>
  );
}

function useVideoItems(queryKey: unknown[], queryFn: () => Promise<unknown>) {
  const {serverConfig} = useAppState();
  const query = useQuery({queryKey, queryFn});
  const items = useMemo(
    () => extractList(query.data).map(item => normalizeVideo(item, serverConfig)),
    [query.data, serverConfig],
  );
  return {query, items};
}

function VideoRemoteList({
  queryKey,
  queryFn,
}: {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
}) {
  const navigation = useNavigation<Navigation>();
  const {query, items} = useVideoItems(queryKey, queryFn);

  if (query.isLoading) {
    return <LoadingState />;
  }
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  return (
    <VideoList
      items={items}
      refreshing={query.isFetching}
      onRefresh={() => query.refetch()}
      onPress={(item: VideoSummary) => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
    />
  );
}

function JsonList({
  queryKey,
  queryFn,
  titleKeys = ['title', 'name', 'code', 'id'],
}: {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  titleKeys?: string[];
}) {
  const colors = useAppColors();
  const query = useQuery({queryKey, queryFn});

  if (query.isLoading) {
    return <LoadingState />;
  }
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }

  const items = extractList(query.data);
  if (!items.length) {
    return <EmptyState />;
  }

  return (
    <Screen>
      {items.map((item, index) => {
        const record = item as Record<string, unknown>;
        const title = titleKeys.map(key => record[key]).find(value => typeof value === 'string');
        return (
          <Card key={String(record.id || record.code || index)} title={String(title || `#${index + 1}`)}>
            <Text style={{color: colors.text, lineHeight: 22}}>{summarizeRecord(item)}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

export function RankingsScreen() {
  const {api} = useAppState();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [type, setType] = useState<'0' | '1' | '2' | '3'>('0');

  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16, gap: 12}}>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            {label: '日榜', value: 'daily'},
            {label: '周榜', value: 'weekly'},
            {label: '月榜', value: 'monthly'},
          ]}
        />
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            {label: '有码', value: '0'},
            {label: '无码', value: '1'},
            {label: '欧美', value: '2'},
            {label: 'FC2', value: '3'},
          ]}
        />
      </View>
      <VideoRemoteList
        queryKey={['rankings', period, type]}
        queryFn={() => api.getRankings(period, Number(type))}
      />
    </Screen>
  );
}

export function LatestScreen() {
  const {api} = useAppState();
  const [type, setType] = useState<'all' | '0' | '1' | '2' | '3'>('all');
  const [filterBy, setFilterBy] = useState<'magnets' | 'subtitle' | 'all'>('magnets');
  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16, gap: 12}}>
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            {label: '全部', value: 'all'},
            {label: '有码', value: '0'},
            {label: '无码', value: '1'},
            {label: '欧美', value: '2'},
            {label: 'FC2', value: '3'},
          ]}
        />
        <SegmentedControl
          value={filterBy}
          onChange={setFilterBy}
          options={[
            {label: '磁链', value: 'magnets'},
            {label: '字幕', value: 'subtitle'},
            {label: '全部', value: 'all'},
          ]}
        />
      </View>
      <VideoRemoteList
        queryKey={['latest', type, filterBy]}
        queryFn={() =>
          api.getLatestMovies({
            page: 1,
            limit: 50,
            type,
            sort_by: 'update',
            filter_by: filterBy,
          })
        }
      />
    </Screen>
  );
}

export function ActorSearchScreen() {
  const navigation = useNavigation<Navigation>();
  const {api} = useAppState();
  const colors = useAppColors();
  const [mode, setMode] = useState<'search' | 'actors' | 'actorOptions' | 'categories' | 'actorCategories'>('search');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'0' | '1' | '2' | '3'>('0');
  const [actorId, setActorId] = useState('');
  const enabled =
    mode === 'search'
      ? !!query.trim()
      : mode === 'actorCategories'
        ? !!actorId.trim()
        : true;
  const result = useQuery({
    queryKey: ['actor-search', mode, query, type, actorId],
    enabled,
    queryFn: () => {
      switch (mode) {
        case 'actors':
          return api.getActors(Number(type));
        case 'actorOptions':
          return api.getActorOptions();
        case 'categories':
          return api.getCategories();
        case 'actorCategories':
          return api.getActorCategories(actorId.trim());
        case 'search':
        default:
          return api.searchActors(query.trim());
      }
    },
  });
  const actors = extractList(result.data);

  return (
    <Screen>
      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          {label: '搜索', value: 'search'},
          {label: '演员库', value: 'actors'},
          {label: '选项', value: 'actorOptions'},
          {label: '类别', value: 'categories'},
          {label: '演员类别', value: 'actorCategories'},
        ]}
      />
      {mode === 'search' ? <Field label="演员" value={query} onChangeText={setQuery} placeholder="输入演员名" /> : null}
      {mode === 'actors' ? (
        <SegmentedControl
          value={type}
          onChange={setType}
          options={[
            {label: '有码', value: '0'},
            {label: '无码', value: '1'},
            {label: '欧美', value: '2'},
            {label: 'FC2', value: '3'},
          ]}
        />
      ) : null}
      {mode === 'actorCategories' ? (
        <Field label="演员 ID" value={actorId} onChangeText={setActorId} placeholder="输入演员外部 ID" />
      ) : null}
      {!enabled ? <EmptyState label="请输入查询条件" /> : null}
      {result.isLoading ? <LoadingState /> : null}
      {result.error ? <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} /> : null}
      {actors.map((actor, index) => {
        const record = actor as Record<string, unknown>;
        const id = String(record.id || record.actor_id || '');
        return (
          <Card key={id || index} title={String(record.name || record.title || id || `演员 ${index + 1}`)}>
            <Text style={{color: colors.mutedText, lineHeight: 22}}>{summarizeRecord(actor)}</Text>
            {id ? (
              <PrimaryButton
                label="查看作品"
                onPress={() => navigation.navigate('EntityMovies', {entity: 'actor', id, title: String(record.name || id)})}
              />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

type FilterProps = NativeStackScreenProps<RootStackParamList, 'Filter'>;

export function FilterScreen({navigation, route}: FilterProps) {
  const {api, serverConfig} = useAppState();
  const [filterType, setFilterType] = useState<'actor' | 'category'>(route.params.type);
  const [id, setId] = useState(route.params.id || '');
  const [value, setValue] = useState(route.params.value || '');
  const options = useMemo(
    () =>
      filterType === 'actor'
        ? id.trim()
          ? {actorId: id.trim()}
          : {actor: value.trim()}
        : id.trim()
          ? {categoryId: id.trim()}
          : {category: value.trim()},
    [filterType, id, value],
  );
  const enabled = Boolean(id.trim() || value.trim());
  const result = useQuery({
    queryKey: ['filter', filterType, id, value],
    enabled,
    queryFn: () => api.getVideosByFilter(options),
  });
  const items = extractList(result.data).map(item => normalizeVideo(item, serverConfig));

  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16, gap: 12}}>
        <SegmentedControl
          value={filterType}
          onChange={setFilterType}
          options={[
            {label: '演员', value: 'actor'},
            {label: '类别', value: 'category'},
          ]}
        />
        <Field label="ID" value={id} onChangeText={setId} placeholder="优先使用外部 ID" />
        <Field label="名称" value={value} onChangeText={setValue} placeholder="没有 ID 时按名称筛选" />
      </View>
      {!enabled ? (
        <EmptyState label="请输入演员或类别的 ID/名称" />
      ) : result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} />
      ) : (
        <VideoList
          items={items}
          refreshing={result.isFetching}
          onRefresh={() => result.refetch()}
          onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
        />
      )}
    </Screen>
  );
}

type EntityProps = NativeStackScreenProps<RootStackParamList, 'EntityMovies'>;

export function EntityMoviesScreen({route}: EntityProps) {
  const {api} = useAppState();
  const params = {page: 1, limit: 50, sort_by: 'release', order_by: 'desc'};
  const queryFn = () => {
    switch (route.params.entity) {
      case 'actor':
        return api.getActorMovies(route.params.id, params);
      case 'series':
        return api.getSeriesMovies(route.params.id, 1, 50, 'release', 'desc');
      case 'makers':
        return api.getMakerMovies(route.params.id, 1, 50, 'release', 'desc');
      case 'publishers':
        return api.getPublisherMovies(route.params.id, 1, 50, 'release', 'desc');
      case 'directors':
        return api.getDirectorMovies(route.params.id, 1, 50, 'release', 'desc');
      case 'lists':
        return api.getListMovies(route.params.id, 1, 50, 'release', 'desc');
      default:
        return api.getEntityMovies(route.params.entity, route.params.id, params);
    }
  };
  return <VideoRemoteList queryKey={['entity-movies', route.params]} queryFn={queryFn} />;
}

export function WatchedScreen() {
  const {api} = useAppState();
  return (
    <VideoRemoteList
      queryKey={['watched']}
      queryFn={() => api.getWatchedMovies({page: 1, limit: 50})}
    />
  );
}

export function FollowingScreen() {
  const {api} = useAppState();
  const [mode, setMode] = useState<'presets' | 'users'>('users');
  const [refresh, setRefresh] = useState(0);
  const actions = useMemo<JsonAction[]>(
    () =>
      mode === 'users'
        ? [
            {
              key: 'followReviewUser',
              label: '关注用户',
              initialJson: '{\n  "user_id": "",\n  "username": ""\n}',
              run: payload => api.followReviewUser(payload),
            },
            {
              key: 'getFollowedReviewUser',
              label: '用户详情',
              initialJson: '{\n  "user_id": ""\n}',
              run: payload => api.getFollowedReviewUser(field(payload, ['user_id', 'id'])),
            },
            {
              key: 'unfollowReviewUsers',
              label: '取消关注',
              initialJson: '{\n  "user_ids": [""]\n}',
              tone: 'danger',
              run: payload => api.unfollowReviewUsers(stringArray(payload, 'user_ids')),
            },
          ]
        : [
            {
              key: 'createFollowingPreset',
              label: '创建预设',
              initialJson: '{\n  "name": "",\n  "filters": {}\n}',
              run: payload => api.createFollowingPreset(payload),
            },
            {
              key: 'updateFollowingPreset',
              label: '更新预设',
              initialJson: '{\n  "id": "",\n  "name": "",\n  "filters": {}\n}',
              run: payload => api.updateFollowingPreset(field(payload, ['id']), withoutKeys(payload, ['id'])),
            },
            {
              key: 'deleteFollowingPreset',
              label: '删除预设',
              initialJson: '{\n  "id": ""\n}',
              tone: 'danger',
              run: payload => api.deleteFollowingPreset(field(payload, ['id'])),
            },
            {
              key: 'reorderFollowingPresets',
              label: '预设排序',
              initialJson: '{\n  "ids": []\n}',
              run: payload => api.reorderFollowingPresets(stringArray(payload, 'ids')),
            },
          ],
    [api, mode],
  );

  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16, gap: 12}}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            {label: '用户', value: 'users'},
            {label: '预设', value: 'presets'},
          ]}
        />
        <JsonActionPanel
          title="关注管理"
          actions={actions}
          onDone={() => setRefresh(value => value + 1)}
        />
      </View>
      <JsonList
        queryKey={['following', mode, refresh]}
        queryFn={mode === 'users' ? api.getFollowedReviewUsers : api.getFollowingPresets}
        titleKeys={['username', 'name', 'user_id', 'id']}
      />
    </Screen>
  );
}

type SubMode = 'local' | 'online' | 'actor' | 'series' | 'matrix' | 'logs';

export function SubscriptionsScreen() {
  const {api} = useAppState();
  const [mode, setMode] = useState<SubMode>('local');
  const [refresh, setRefresh] = useState(0);
  const queryMap: Record<SubMode, () => Promise<unknown>> = {
    local: () => api.getSubscriptions({videos: true}),
    online: () => api.getOnlineSubscriptions({page: 1, limit: 50}),
    actor: () => api.getActorSubscriptions(),
    series: () => api.getSeriesSubscriptions(),
    matrix: () => api.getSubscriptionMatrix(),
    logs: () => api.getSubscriptionLog({limit: 50}),
  };

  const runSync = async () => {
    try {
      if (mode === 'online') {
        await api.syncOnlineSubscriptions();
      } else if (mode === 'actor') {
        await api.runActorSubscriptions();
      } else if (mode === 'series') {
        await api.runSeriesSubscriptions();
      } else {
        await api.batchCheckSubscriptions([]);
      }
      Alert.alert('任务已提交', '请查看调度器状态');
    } catch (error) {
      Alert.alert('提交失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const actions = useMemo<JsonAction[]>(() => {
    const seriesId = (payload: JsonRecord) => field(payload, ['external_id', 'externalId', 'id']);
    const seriesType = (payload: JsonRecord) => String(payload.sub_type || payload.subType || 'series');
    const videoCode = (payload: JsonRecord) => field(payload, ['video_code', 'videoCode', 'code']);

    switch (mode) {
      case 'local':
        return [
          {
            key: 'createSubscription',
            label: '创建订阅',
            initialJson: '{\n  "code": "",\n  "enabled": true\n}',
            run: payload => api.createSubscription(payload),
          },
          {
            key: 'updateSubscription',
            label: '更新订阅',
            initialJson: '{\n  "code": "",\n  "enabled": true\n}',
            run: payload => api.updateSubscription(field(payload, ['code']), withoutKeys(payload, ['code'])),
          },
          {
            key: 'deleteSubscription',
            label: '删除订阅',
            initialJson: '{\n  "code": ""\n}',
            tone: 'danger',
            run: payload => api.deleteSubscription(field(payload, ['code'])),
          },
          {
            key: 'checkSubscription',
            label: '检查单项',
            initialJson: '{\n  "code": ""\n}',
            run: payload => api.checkSubscription(field(payload, ['code'])),
          },
          {
            key: 'batchCheckSubscriptions',
            label: '批量检查',
            initialJson: '{\n  "codes": []\n}',
            run: payload => api.batchCheckSubscriptions(stringArray(payload, 'codes')),
          },
          {
            key: 'batchCheckSubscriptionStatus',
            label: '批量状态',
            initialJson: '{\n  "codes": []\n}',
            run: payload => api.batchCheckSubscriptionStatus(payload),
          },
          {
            key: 'batchRecollectVideos',
            label: '批量重刮削',
            initialJson: '{\n  "codes": []\n}',
            run: payload => api.batchRecollectVideos(stringArray(payload, 'codes')),
          },
          {
            key: 'batchDeleteVideos',
            label: '批量删除影片',
            initialJson: '{\n  "codes": []\n}',
            tone: 'danger',
            run: payload => api.batchDeleteVideos(stringArray(payload, 'codes')),
          },
        ];
      case 'online':
        return [
          {key: 'syncOnlineSubscriptions', label: '同步在线订阅', run: () => api.syncOnlineSubscriptions()},
          {key: 'getSubscriptionPreset', label: '读取预设', run: () => api.getSubscriptionPreset()},
          {
            key: 'updateSubscriptionPreset',
            label: '更新预设',
            initialJson: '{\n  "preset": {}\n}',
            run: payload => api.updateSubscriptionPreset(payload),
          },
          {
            key: 'overwriteSubscriptionPreset',
            label: '覆盖预设',
            initialJson: '{\n  "preset": {}\n}',
            run: payload => api.overwriteSubscriptionPreset(payload),
          },
          {
            key: 'exportSubscriptionShare',
            label: '导出分享',
            initialJson: '{\n  "codes": []\n}',
            run: payload => api.exportSubscriptionShare(payload),
          },
          {
            key: 'analyzeSubscriptionShare',
            label: '分析分享',
            initialJson: '{\n  "content": ""\n}',
            run: payload => api.analyzeSubscriptionShare(payload),
          },
          {
            key: 'importSubscriptionShare',
            label: '导入分享',
            initialJson: '{\n  "content": ""\n}',
            run: payload => api.importSubscriptionShare(payload),
          },
          {key: 'getRankingAutoConfig', label: '排行订阅配置', run: () => api.getRankingAutoConfig()},
          {
            key: 'updateRankingAutoConfig',
            label: '更新排行配置',
            initialJson: '{\n  "enabled": false\n}',
            run: payload => api.updateRankingAutoConfig(payload),
          },
          {key: 'getAutoSyncStatus', label: '自动同步状态', run: () => api.getAutoSyncStatus()},
          {
            key: 'updateAutoSync',
            label: '更新自动同步',
            initialJson: '{\n  "enabled": false\n}',
            run: payload => api.updateAutoSync(payload),
          },
          {
            key: 'getTop250',
            label: 'Top250',
            initialJson: '{\n  "page": 1,\n  "limit": 50\n}',
            run: payload => api.getTop250(payload),
          },
          {
            key: 'subscribeTop250',
            label: '订阅 Top250',
            initialJson: '{\n  "codes": []\n}',
            run: payload => api.subscribeTop250(payload),
          },
          {
            key: 'getTaggedMovies',
            label: '标签影片',
            initialJson: '{\n  "page": 1,\n  "limit": 50,\n  "tag": ""\n}',
            run: payload => api.getTaggedMovies(payload),
          },
        ];
      case 'actor':
        return [
          {
            key: 'createActorSubscription',
            label: '创建演员订阅',
            initialJson: '{\n  "actor_id": "",\n  "name": ""\n}',
            run: payload => api.createActorSubscription(payload),
          },
          {
            key: 'getActorSubscription',
            label: '订阅详情',
            initialJson: '{\n  "actor_id": ""\n}',
            run: payload => api.getActorSubscription(field(payload, ['actor_id', 'actorId', 'id'])),
          },
          {
            key: 'updateActorSubscription',
            label: '更新演员订阅',
            initialJson: '{\n  "actor_id": "",\n  "enabled": true\n}',
            run: payload => api.updateActorSubscription(field(payload, ['actor_id', 'actorId', 'id']), withoutKeys(payload, ['actor_id', 'actorId', 'id'])),
          },
          {
            key: 'deleteActorSubscription',
            label: '删除演员订阅',
            initialJson: '{\n  "actor_id": ""\n}',
            tone: 'danger',
            run: payload => api.deleteActorSubscription(field(payload, ['actor_id', 'actorId', 'id'])),
          },
          {
            key: 'checkActorSubscription',
            label: '检查演员',
            initialJson: '{\n  "actor_id": ""\n}',
            run: payload => api.checkActorSubscription(field(payload, ['actor_id', 'actorId', 'id'])),
          },
          {
            key: 'batchCheckActorSubscriptions',
            label: '批量检查演员',
            initialJson: '{\n  "actor_ids": []\n}',
            run: payload => api.batchCheckActorSubscriptions(stringArray(payload, 'actor_ids')),
          },
          {key: 'runActorSubscriptions', label: '执行全部演员', run: () => api.runActorSubscriptions()},
          {
            key: 'runActorSubscription',
            label: '执行单个演员',
            initialJson: '{\n  "actor_id": ""\n}',
            run: payload => api.runActorSubscription(field(payload, ['actor_id', 'actorId', 'id'])),
          },
          {
            key: 'getActorSubscriptionVideos',
            label: '演员订阅影片',
            initialJson: '{\n  "actor_id": "",\n  "status": "",\n  "page": 1,\n  "limit": 50\n}',
            run: payload => api.getActorSubscriptionVideos(field(payload, ['actor_id', 'actorId', 'id']), subscriptionVideoOptions(payload)),
          },
          {
            key: 'batchSkipActorSubscriptionVideos',
            label: '批量跳过影片',
            initialJson: '{\n  "actor_id": "",\n  "codes": []\n}',
            run: payload => api.batchSkipActorSubscriptionVideos(field(payload, ['actor_id', 'actorId', 'id']), stringArray(payload, 'codes')),
          },
          {
            key: 'batchRestoreActorSubscriptionVideos',
            label: '批量恢复影片',
            initialJson: '{\n  "actor_id": "",\n  "codes": []\n}',
            run: payload => api.batchRestoreActorSubscriptionVideos(field(payload, ['actor_id', 'actorId', 'id']), stringArray(payload, 'codes')),
          },
          {
            key: 'updateActorSubscriptionVideo',
            label: '更新影片状态',
            initialJson: '{\n  "actor_id": "",\n  "code": "",\n  "status": ""\n}',
            run: payload =>
              api.updateActorSubscriptionVideo(
                field(payload, ['actor_id', 'actorId', 'id']),
                videoCode(payload),
                withoutKeys(payload, ['actor_id', 'actorId', 'id', 'video_code', 'videoCode', 'code']),
              ),
          },
          {
            key: 'skipActorSubscriptionVideo',
            label: '跳过单个影片',
            initialJson: '{\n  "actor_id": "",\n  "code": ""\n}',
            run: payload => api.skipActorSubscriptionVideo(field(payload, ['actor_id', 'actorId', 'id']), videoCode(payload)),
          },
        ];
      case 'series':
        return [
          {
            key: 'createSeriesSubscription',
            label: '创建系列订阅',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "name": ""\n}',
            run: payload => api.createSeriesSubscription(payload),
          },
          {
            key: 'getSeriesSubscription',
            label: '订阅详情',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series"\n}',
            run: payload => api.getSeriesSubscription(seriesId(payload), seriesType(payload)),
          },
          {
            key: 'updateSeriesSubscription',
            label: '更新系列订阅',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "enabled": true\n}',
            run: payload =>
              api.updateSeriesSubscription(
                seriesId(payload),
                withoutKeys(payload, ['external_id', 'externalId', 'id', 'sub_type', 'subType']),
                seriesType(payload),
              ),
          },
          {
            key: 'deleteSeriesSubscription',
            label: '删除系列订阅',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series"\n}',
            tone: 'danger',
            run: payload => api.deleteSeriesSubscription(seriesId(payload), seriesType(payload)),
          },
          {
            key: 'checkSeriesSubscription',
            label: '检查系列',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series"\n}',
            run: payload => api.checkSeriesSubscription(seriesId(payload), seriesType(payload)),
          },
          {
            key: 'batchCheckSeriesSubscriptions',
            label: '批量检查系列',
            initialJson: '{\n  "external_ids": [],\n  "sub_type": "series"\n}',
            run: payload => api.batchCheckSeriesSubscriptions(stringArray(payload, 'external_ids'), seriesType(payload)),
          },
          {
            key: 'runSeriesSubscriptions',
            label: '执行全部系列',
            initialJson: '{\n  "sub_type": "series"\n}',
            run: payload => api.runSeriesSubscriptions(seriesType(payload)),
          },
          {
            key: 'runSeriesSubscription',
            label: '执行单个系列',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series"\n}',
            run: payload => api.runSeriesSubscription(seriesId(payload), seriesType(payload)),
          },
          {
            key: 'getSeriesSubscriptionVideos',
            label: '系列订阅影片',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "status": "",\n  "page": 1,\n  "limit": 50\n}',
            run: payload =>
              api.getSeriesSubscriptionVideos(
                seriesId(payload),
                {...subscriptionVideoOptions(payload), subType: seriesType(payload)},
              ),
          },
          {
            key: 'batchSkipSeriesSubscriptionVideos',
            label: '批量跳过影片',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "codes": []\n}',
            run: payload => api.batchSkipSeriesSubscriptionVideos(seriesId(payload), stringArray(payload, 'codes'), seriesType(payload)),
          },
          {
            key: 'batchRestoreSeriesSubscriptionVideos',
            label: '批量恢复影片',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "codes": []\n}',
            run: payload => api.batchRestoreSeriesSubscriptionVideos(seriesId(payload), stringArray(payload, 'codes'), seriesType(payload)),
          },
          {
            key: 'updateSeriesSubscriptionVideo',
            label: '更新影片状态',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "code": "",\n  "status": ""\n}',
            run: payload =>
              api.updateSeriesSubscriptionVideo(
                seriesId(payload),
                videoCode(payload),
                withoutKeys(payload, ['external_id', 'externalId', 'id', 'sub_type', 'subType', 'video_code', 'videoCode', 'code']),
                seriesType(payload),
              ),
          },
          {
            key: 'skipSeriesSubscriptionVideo',
            label: '跳过单个影片',
            initialJson: '{\n  "external_id": "",\n  "sub_type": "series",\n  "code": ""\n}',
            run: payload => api.skipSeriesSubscriptionVideo(seriesId(payload), videoCode(payload), seriesType(payload)),
          },
        ];
      case 'logs':
        return [
          {
            key: 'clearSubscriptionLog',
            label: '清理日志',
            initialJson: '{\n  "date": null\n}',
            tone: 'danger',
            run: payload => api.clearSubscriptionLog(typeof payload.date === 'string' ? payload.date : null),
          },
        ];
      case 'matrix':
      default:
        return [
          {
            key: 'getSubscriptionMatrix',
            label: '刷新矩阵',
            initialJson: '{\n  "page": 1,\n  "limit": 50\n}',
            run: payload => api.getSubscriptionMatrix(payload),
          },
        ];
    }
  }, [api, mode]);

  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16, gap: 12}}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            {label: '本地', value: 'local'},
            {label: '在线', value: 'online'},
            {label: '演员', value: 'actor'},
            {label: '综合', value: 'series'},
            {label: '矩阵', value: 'matrix'},
            {label: '日志', value: 'logs'},
          ]}
        />
        <PrimaryButton label="执行/同步" onPress={runSync} tone="neutral" />
        <JsonActionPanel
          title="订阅管理"
          actions={actions}
          onDone={() => setRefresh(value => value + 1)}
        />
      </View>
      {mode === 'local' || mode === 'online' ? (
        <VideoRemoteList queryKey={['subscriptions', mode, refresh]} queryFn={queryMap[mode]} />
      ) : (
        <JsonList queryKey={['subscriptions', mode, refresh]} queryFn={queryMap[mode]} />
      )}
    </Screen>
  );
}

type DownloadMode = 'downloaders' | 'aria2' | 'qb' | 'thunder' | 'pan115';
type TaskFilter = 'all' | 'downloading' | 'paused' | 'completed';
type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary' | 'secondary';
type IconComponent = React.ComponentType<{color?: string; size?: number; strokeWidth?: number}>;

type NormalizedTask = {
  record: Record<string, unknown>;
  id: string;
  title: string;
  statusKey: string;
  statusLabel: string;
  progressRatio: number;
  sizeBytes: number;
  completedBytes: number;
  downloadSpeedBytes: number;
  uploadSpeedBytes: number;
  savePath: string;
  addedAt: unknown;
  completedAt: unknown;
  etaSeconds: number;
  rawState: string;
};

const downloadModeOptions: Array<{label: string; value: DownloadMode}> = [
  {label: '下载器', value: 'downloaders'},
  {label: 'Aria2', value: 'aria2'},
  {label: 'qB', value: 'qb'},
  {label: '迅雷', value: 'thunder'},
  {label: '115', value: 'pan115'},
];

const taskFilterOptions: Array<{label: string; value: TaskFilter}> = [
  {label: '全部', value: 'all'},
  {label: '下载中', value: 'downloading'},
  {label: '暂停', value: 'paused'},
  {label: '已完成', value: 'completed'},
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const nestedRecord = (value: unknown, key: string) => {
  const record = asRecord(value);
  return asRecord(record[key]);
};

const firstArray = (payload: unknown, keys: string[]) => {
  const record = asRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }
  const data = nestedRecord(payload, 'data');
  for (const key of keys) {
    if (Array.isArray(data[key])) {
      return data[key] as unknown[];
    }
  }
  return extractList<unknown>(payload);
};

const extractDownloadItems = (payload: unknown, mode: DownloadMode) => {
  if (mode === 'downloaders') {
    return firstArray(payload, ['downloaders', 'items', 'list', 'results']);
  }
  if (mode === 'qb') {
    return firstArray(payload, ['torrents', 'tasks', 'items', 'list', 'results']);
  }
  return firstArray(payload, ['tasks', 'items', 'list', 'results', 'records']);
};

const textFrom = (record: Record<string, unknown>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return fallback;
};

const numericFrom = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

const clampRatio = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const fileName = (value: unknown) => {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalized;
};

const taskTitle = (record: Record<string, unknown>) =>
  textFrom(record, ['name', 'title', 'filename', 'file_name']) ||
  textFrom(asRecord(record.bittorrent), ['name']) ||
  textFrom(asRecord(asRecord(record.bittorrent).info), ['name']) ||
  fileName(asRecord(Array.isArray(record.files) ? record.files[0] : {}).path) ||
  textFrom(record, ['hash', 'gid', 'id'], '任务');

const taskId = (record: Record<string, unknown>, mode: DownloadMode) => {
  if (mode === 'aria2') {
    return String(record.gid || record.id || '').trim();
  }
  if (mode === 'qb') {
    return String(record.hash || record.id || '').trim();
  }
  return String(record.id || record.task_id || record.gid || record.hash || '').trim();
};

const taskStatusKey = (record: Record<string, unknown>) => {
  const state = textFrom(record, ['status_key', 'statusKey', 'status', 'state', 'raw_status', 'rawState', 'phase']).toLowerCase();
  if (!state) {
    return 'unknown';
  }
  if (state.includes('error') || state.includes('fail') || state.includes('missing')) {
    return 'error';
  }
  if (
    state.includes('complete') ||
    state.includes('done') ||
    state.includes('success') ||
    state.includes('upload') ||
    state.includes('stalledup') ||
    state.includes('queuedup') ||
    state.includes('forcedup')
  ) {
    return 'completed';
  }
  if (state.includes('pause') || state.includes('stop')) {
    return 'paused';
  }
  if (state.includes('wait') || state.includes('queue') || state.includes('stalled') || state.includes('check') || state.includes('meta')) {
    return 'waiting';
  }
  if (state.includes('active') || state.includes('download') || state.includes('running') || state.includes('forceddl')) {
    return 'downloading';
  }
  return 'unknown';
};

const taskStatusLabel = (statusKey: string, mode: DownloadMode) => {
  if (mode === 'qb' && statusKey === 'paused') {
    return '已停止';
  }
  switch (statusKey) {
    case 'downloading':
      return '下载中';
    case 'waiting':
      return '等待中';
    case 'paused':
      return '已暂停';
    case 'completed':
      return '已完成';
    case 'error':
      return '异常';
    default:
      return '未知';
  }
};

const taskBadgeTone = (statusKey: string): BadgeTone => {
  if (statusKey === 'completed') return 'success';
  if (statusKey === 'downloading') return 'info';
  if (statusKey === 'waiting') return 'warning';
  if (statusKey === 'paused') return 'neutral';
  if (statusKey === 'error') return 'danger';
  return 'secondary';
};

const primaryTaskAction = (record: Record<string, unknown>, mode: DownloadMode) => {
  const state = taskStatusKey(record);
  if (mode === 'qb') {
    if (state === 'paused') return 'resume';
    if (state === 'downloading' || state === 'waiting' || state === 'completed') return 'pause';
  }
  if (mode === 'aria2') {
    if (state === 'paused') return 'resume';
    if (state === 'waiting' || state === 'downloading') return 'pause';
  }
  if (mode === 'thunder') {
    if (state === 'paused') return 'resume';
    if (state === 'downloading' || state === 'waiting') return 'pause';
  }
  return '';
};

const sizeBytes = (record: Record<string, unknown>) => {
  const bytes = numericFrom(record, [
    'sizeBytes',
    'size_bytes',
    'size',
    'totalLength',
    'total_length',
    'total',
    'file_size',
    'fileSize',
  ]);
  if (bytes > 0) {
    return bytes;
  }
  return numericFrom(record, ['size_mb', 'sizeMb']) * 1024 * 1024;
};

const completedBytes = (record: Record<string, unknown>, size: number, progress: number) => {
  const bytes = numericFrom(record, [
    'completedBytes',
    'completed_bytes',
    'completedLength',
    'completed_length',
    'downloaded',
    'downloaded_bytes',
    'downloadedBytes',
  ]);
  if (bytes > 0) {
    return bytes;
  }
  return size > 0 && progress > 0 ? Math.round(size * progress) : 0;
};

const progressRatio = (record: Record<string, unknown>, statusKey: string, size: number) => {
  const raw = numericFrom(record, ['progressRatio', 'progress_ratio', 'progress', 'percent']);
  if (raw > 0) {
    return clampRatio(raw > 1 ? raw / 100 : raw);
  }
  const completed = numericFrom(record, ['completedBytes', 'completed_bytes', 'completedLength', 'completed_length', 'downloaded']);
  if (size > 0 && completed > 0) {
    return clampRatio(completed / size);
  }
  return statusKey === 'completed' ? 1 : 0;
};

const formatBytesValue = (bytes: number) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const display = value / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : display >= 100 ? 0 : display >= 10 ? 1 : 2;
  return `${display.toFixed(digits)} ${units[exponent]}`;
};

const formatSpeedValue = (bytes: number) => `${formatBytesValue(bytes)}/s`;

const formatPercent = (ratio: number) => `${Math.round(clampRatio(ratio) * 100)}%`;

const formatEta = (seconds: number) => {
  const total = Math.floor(Number(seconds || 0));
  if (!Number.isFinite(total) || total <= 0) {
    return '未知';
  }
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  if (!days && parts.length < 2) parts.push(`${secs}s`);
  return parts.join(' ');
};

const formatTimeValue = (value: unknown) => {
  if (!value) {
    return '未知';
  }
  const raw = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
  const timeValue =
    Number.isFinite(raw) && raw > 0
      ? raw > 100000000000
        ? raw
        : raw > 1000000000
          ? raw * 1000
          : 0
      : 0;
  const date = timeValue > 0 ? new Date(timeValue) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return '未知';
  }
  return date.toLocaleString();
};

const normalizeTask = (item: unknown, mode: DownloadMode): NormalizedTask => {
  const record = asRecord(item);
  const statusKey = taskStatusKey(record);
  const size = sizeBytes(record);
  const progress = progressRatio(record, statusKey, size);
  const completed = completedBytes(record, size, progress);
  const downloadSpeed = numericFrom(record, ['downloadSpeedBytes', 'download_speed_bytes', 'downloadSpeed', 'download_speed', 'dlspeed', 'speed']);
  return {
    record,
    id: taskId(record, mode),
    title: taskTitle(record),
    statusKey,
    statusLabel: taskStatusLabel(statusKey, mode),
    progressRatio: progress,
    sizeBytes: size,
    completedBytes: completed,
    downloadSpeedBytes: downloadSpeed,
    uploadSpeedBytes: numericFrom(record, ['uploadSpeedBytes', 'upload_speed_bytes', 'uploadSpeed', 'upload_speed', 'upspeed']),
    savePath: textFrom(record, ['savePath', 'save_path', 'dir', 'path', 'download_path'], '-'),
    addedAt: record.addedAt || record.added_at || record.added_on || record.created_at || record.create_time,
    completedAt: record.completedAt || record.completed_at || record.completion_on || record.finished_at,
    etaSeconds:
      numericFrom(record, ['etaSeconds', 'eta_seconds', 'eta', 'remaining_time', 'remainingTime']) ||
      (downloadSpeed > 0 ? Math.ceil(Math.max(0, size - completed) / downloadSpeed) : 0),
    rawState: textFrom(record, ['state', 'status', 'raw_status', 'rawState', 'phase']),
  };
};

const matchesTaskFilter = (task: NormalizedTask, filter: TaskFilter) => {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'downloading') {
    return task.statusKey === 'downloading' || task.statusKey === 'waiting';
  }
  if (filter === 'paused') {
    return task.statusKey === 'paused';
  }
  return task.statusKey === 'completed';
};

function HeaderAction({label, onPress, spinning = false}: {label: string; onPress: () => void; spinning?: boolean}) {
  const colors = useAppColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[downloadStyles.headerAction, {borderColor: colors.panelBorder}]}>
      <RefreshCw size={14} color={colors.primary} strokeWidth={2.2} />
      <Text style={[downloadStyles.headerActionText, {color: colors.primary}]}>{spinning ? '刷新中' : label}</Text>
    </Pressable>
  );
}

function StatTile({label, value, tone = 'neutral'}: {label: string; value: string; tone?: BadgeTone}) {
  const colors = useAppColors();
  const toneColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'info'
            ? colors.primary
            : colors.secondaryText;
  return (
    <View style={[downloadStyles.statTile, {borderColor: colors.panelBorder, backgroundColor: colors.inputBg}]}>
      <Text style={[downloadStyles.statLabel, {color: colors.mutedText}]}>{label}</Text>
      <Text style={[downloadStyles.statValue, {color: toneColor}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatusDot({statusKey}: {statusKey: string}) {
  const colors = useAppColors();
  const backgroundColor =
    statusKey === 'downloading'
      ? colors.primary
      : statusKey === 'waiting'
        ? colors.warning
        : statusKey === 'paused'
          ? colors.secondaryText
          : statusKey === 'completed'
            ? colors.success
            : statusKey === 'error'
              ? colors.danger
              : colors.mutedText;
  return <View style={[downloadStyles.statusDot, {backgroundColor, shadowColor: backgroundColor}]} />;
}

function ProgressBar({ratio}: {ratio: number}) {
  const colors = useAppColors();
  return (
    <View style={[downloadStyles.progressTrack, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      <View style={[downloadStyles.progressFill, {backgroundColor: colors.primary, width: `${Math.round(clampRatio(ratio) * 100)}%`}]} />
    </View>
  );
}

function TaskMetric({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tone?: BadgeTone;
}) {
  const colors = useAppColors();
  const iconColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'secondary'
            ? colors.secondary
            : colors.primary;
  return (
    <View style={[downloadStyles.metric, {borderColor: colors.panelBorder, backgroundColor: colors.inputBg}]}>
      <View style={downloadStyles.metricHeader}>
        <Icon size={13} color={iconColor} strokeWidth={2.2} />
        <Text style={[downloadStyles.metricLabel, {color: colors.mutedText}]}>{label}</Text>
      </View>
      <Text style={[downloadStyles.metricValue, {color: colors.text}]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function RoundActionButton({
  icon: Icon,
  tone = 'primary',
  onPress,
  disabled,
}: {
  icon: IconComponent;
  tone?: 'primary' | 'danger';
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  const color = tone === 'danger' ? colors.danger : colors.primary;
  const backgroundColor = tone === 'danger' ? colors.accentSoft : colors.primarySoft;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        downloadStyles.roundButton,
        {
          backgroundColor: pressed ? backgroundColor : colors.inputBg,
          borderColor: color,
          opacity: disabled ? 0.5 : 1,
          shadowColor: color,
        },
      ]}>
      <Icon size={15} color={color} strokeWidth={2.4} />
    </Pressable>
  );
}

function DownloadTaskCard({
  task,
  mode,
  busy,
  onAction,
  onDelete,
}: {
  task: NormalizedTask;
  mode: DownloadMode;
  busy: boolean;
  onAction: (task: NormalizedTask, action: string) => void;
  onDelete: (task: NormalizedTask) => void;
}) {
  const colors = useAppColors();
  const action = primaryTaskAction(task.record, mode);
  const actionable = mode === 'aria2' || mode === 'qb' || mode === 'thunder';
  const timeValue = task.statusKey === 'completed' ? formatTimeValue(task.completedAt) : formatEta(task.etaSeconds);
  const timeLabel = task.statusKey === 'completed' ? '完成时间' : '剩余时间';

  return (
    <Card variant="strong" style={downloadStyles.taskCard}>
      <View style={downloadStyles.taskHeader}>
        <View style={downloadStyles.taskTitleWrap}>
          <StatusDot statusKey={task.statusKey} />
          <View style={downloadStyles.taskTitleTextWrap}>
            <Text style={[downloadStyles.taskTitle, {color: colors.text}]} numberOfLines={2}>
              {task.title}
            </Text>
            <View style={downloadStyles.badgeRow}>
              <Badge label={task.statusLabel} tone={taskBadgeTone(task.statusKey)} />
              {task.rawState ? <Badge label={task.rawState} tone="secondary" /> : null}
            </View>
          </View>
        </View>
        {actionable ? (
          <View style={downloadStyles.taskActions}>
            {action ? (
              <RoundActionButton icon={action === 'resume' ? Play : Pause} disabled={busy} onPress={() => onAction(task, action)} />
            ) : null}
            <RoundActionButton icon={Trash2} tone="danger" disabled={busy} onPress={() => onDelete(task)} />
          </View>
        ) : null}
      </View>

      <View style={downloadStyles.progressBlock}>
        <View style={downloadStyles.progressMeta}>
          <Text style={[downloadStyles.progressText, {color: colors.text}]}>{formatPercent(task.progressRatio)}</Text>
          <Text style={[downloadStyles.progressText, {color: colors.mutedText}]} numberOfLines={1}>
            {formatBytesValue(task.completedBytes)} / {formatBytesValue(task.sizeBytes)}
          </Text>
        </View>
        <ProgressBar ratio={task.progressRatio} />
      </View>

      <View style={downloadStyles.metricGrid}>
        <TaskMetric icon={ArrowDown} label="下载速度" value={formatSpeedValue(task.downloadSpeedBytes)} />
        <TaskMetric icon={ArrowUp} label="上传速度" value={formatSpeedValue(task.uploadSpeedBytes)} tone="secondary" />
        <TaskMetric icon={ListOrdered} label={timeLabel} value={timeValue} tone={task.statusKey === 'completed' ? 'success' : 'warning'} />
        <TaskMetric icon={Download} label="保存路径" value={task.savePath || '-'} />
      </View>
    </Card>
  );
}

function DownloaderInfoCard({item}: {item: unknown}) {
  const colors = useAppColors();
  const record = asRecord(item);
  const name = textFrom(record, ['name', 'key', 'id'], '下载器');
  const enabled = record.enabled === true || record.available === true || record.runtime_enabled === true;
  const label = textFrom(record, ['label', 'display_name', 'title'], name);
  const message = textFrom(record, ['message', 'status', 'description', 'error'], enabled ? '已启用，可接收下载任务' : '未启用或配置不可用');

  return (
    <Card variant="strong" style={downloadStyles.taskCard}>
      <View style={downloadStyles.downloaderHeader}>
        <View style={downloadStyles.taskTitleWrap}>
          <StatusDot statusKey={enabled ? 'completed' : 'paused'} />
          <View style={downloadStyles.taskTitleTextWrap}>
            <Text style={[downloadStyles.taskTitle, {color: colors.text}]}>{label}</Text>
            <Text style={[downloadStyles.downloaderName, {color: colors.mutedText}]}>{name}</Text>
          </View>
        </View>
        <Badge label={enabled ? '已启用' : '未启用'} tone={enabled ? 'success' : 'neutral'} />
      </View>
      <Text style={[downloadStyles.downloaderMessage, {color: colors.secondaryText}]}>{message}</Text>
    </Card>
  );
}

function DownloadTaskList({
  mode,
  queryFn,
}: {
  mode: DownloadMode;
  queryFn: (filter: TaskFilter) => Promise<unknown>;
}) {
  const {api} = useAppState();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [busyKey, setBusyKey] = useState('');
  const query = useQuery({queryKey: ['download-tasks', mode, filter], queryFn: () => queryFn(filter)});
  const items = extractDownloadItems(query.data, mode);
  const tasks = useMemo(
    () => items.map(item => normalizeTask(item, mode)).filter(task => task.id || task.title !== '任务'),
    [items, mode],
  );
  const visibleTasks = mode === 'downloaders' ? tasks : tasks.filter(task => matchesTaskFilter(task, filter));
  const totalDownloadSpeed = tasks.reduce((sum, task) => sum + task.downloadSpeedBytes, 0);
  const totalUploadSpeed = tasks.reduce((sum, task) => sum + task.uploadSpeedBytes, 0);
  const completedCount = tasks.filter(task => task.statusKey === 'completed').length;
  const activeCount = tasks.filter(task => task.statusKey === 'downloading' || task.statusKey === 'waiting').length;
  const enabledDownloaders = items.filter(item => {
    const record = asRecord(item);
    return record.enabled === true || record.available === true || record.runtime_enabled === true;
  }).length;

  const runAction = async (task: NormalizedTask, action: string, deleteFiles = false) => {
    const id = task.id;
    if (!id) {
      Alert.alert('任务操作失败', '当前任务缺少 ID');
      return;
    }

    const actionKey = `${mode}:${id}:${action}`;
    setBusyKey(actionKey);
    try {
      if (mode === 'aria2') {
        await api.aria2Action({action, gid: id});
      } else if (mode === 'qb') {
        await api.qbittorrentAction({action, hash: id, ...(action === 'delete' ? {delete_files: deleteFiles} : {})});
      } else if (mode === 'thunder') {
        await api.thunderAction({
          action,
          id,
          type: String(task.record.type || 'user#download-url'),
        });
      }
      await query.refetch();
    } catch (error) {
      Alert.alert('任务操作失败', error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusyKey('');
    }
  };

  const confirmDelete = (task: NormalizedTask) => {
    const buttons =
      mode === 'qb'
        ? [
            {text: '取消', style: 'cancel' as const},
            {text: '仅删除任务', style: 'destructive' as const, onPress: () => runAction(task, 'delete', false)},
            {text: '删除并清理文件', style: 'destructive' as const, onPress: () => runAction(task, 'delete', true)},
          ]
        : [
            {text: '取消', style: 'cancel' as const},
            {text: '删除任务', style: 'destructive' as const, onPress: () => runAction(task, 'delete', false)},
          ];
    Alert.alert('删除下载任务', task.title, buttons);
  };

  if (query.isLoading) {
    return <LoadingState />;
  }
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  if (!items.length) {
    return (
      <Card variant="cyber" title={mode === 'downloaders' ? '下载器状态' : '下载任务'}>
        <EmptyState label={mode === 'downloaders' ? '暂无下载器配置' : '暂无下载任务'} />
      </Card>
    );
  }

  return (
    <View style={downloadStyles.listWrap}>
      <Card
        variant="cyber"
        title={mode === 'downloaders' ? '下载器状态' : `${downloadModeOptions.find(option => option.value === mode)?.label || mode} 任务`}
        action={<HeaderAction label="刷新" spinning={query.isFetching} onPress={() => void query.refetch()} />}>
        {mode === 'downloaders' ? (
          <View style={downloadStyles.statGrid}>
            <StatTile label="已启用" value={`${enabledDownloaders}`} tone="success" />
            <StatTile label="全部下载器" value={`${items.length}`} />
          </View>
        ) : (
          <>
            <View style={downloadStyles.statGrid}>
              <StatTile label="任务数" value={`${tasks.length}`} />
              <StatTile label="下载中" value={`${activeCount}`} tone="info" />
              <StatTile label="已完成" value={`${completedCount}`} tone="success" />
              <StatTile label="总下载" value={formatSpeedValue(totalDownloadSpeed)} tone="info" />
              <StatTile label="总上传" value={formatSpeedValue(totalUploadSpeed)} tone="secondary" />
            </View>
            <SegmentedControl value={filter} onChange={setFilter} options={taskFilterOptions} />
          </>
        )}
      </Card>

      {mode === 'downloaders' ? (
        items.map((item, index) => <DownloaderInfoCard key={String(asRecord(item).name || index)} item={item} />)
      ) : visibleTasks.length ? (
        visibleTasks.map(task => (
          <DownloadTaskCard
            key={`${mode}:${task.id || task.title}`}
            task={task}
            mode={mode}
            busy={busyKey.startsWith(`${mode}:${task.id}:`)}
            onAction={(selected, action) => void runAction(selected, action)}
            onDelete={confirmDelete}
          />
        ))
      ) : (
        <Card variant="strong">
          <EmptyState label="当前筛选下没有任务" />
        </Card>
      )}
    </View>
  );
}

export function DownloadTasksScreen() {
  const {api} = useAppState();
  const colors = useAppColors();
  const [mode, setMode] = useState<DownloadMode>('downloaders');
  const queryMap: Record<DownloadMode, (filter: TaskFilter) => Promise<unknown>> = {
    downloaders: () => api.getDownloaders({include_disabled: true}),
    aria2: api.aria2Tasks,
    qb: filter => api.qbittorrentTasks(filter === 'downloading' ? 'all' : filter),
    thunder: api.thunderTasks,
    pan115: filter => api.pan115Tasks(filter, 1, 30),
  };
  return (
    <Screen>
      <Card variant="cyber" title="下载任务">
        <View style={downloadStyles.screenTitleRow}>
          <Download size={18} color={colors.primary} />
          <Text style={[downloadStyles.screenHint, {color: colors.mutedText}]}>
            查看各下载器实时队列，执行暂停、恢复和删除操作。
          </Text>
        </View>
        <SegmentedControl value={mode} onChange={setMode} options={downloadModeOptions} />
      </Card>
      <DownloadTaskList mode={mode} queryFn={queryMap[mode]} />
    </Screen>
  );
}

export function DownloadRecordsScreen() {
  const {api} = useAppState();
  const colors = useAppColors();
  const records = useQuery({
    queryKey: ['download-records'],
    queryFn: () => api.getDownloadRecords({page: 1, page_size: 50}),
  });
  const clear = async () => {
    try {
      await api.clearDownloadRecords();
      await records.refetch();
    } catch (error) {
      Alert.alert('清理失败', error instanceof Error ? error.message : '请求失败');
    }
  };
  const confirmClear = () => {
    Alert.alert('清空下载记录', '确认清空所有下载记录？', [
      {text: '取消', style: 'cancel'},
      {text: '清空', style: 'destructive', onPress: () => void clear()},
    ]);
  };
  const items = extractDownloadItems(records.data, 'pan115');

  return (
    <Screen>
      <Card
        variant="cyber"
        title="下载记录"
        action={<HeaderAction label="刷新" spinning={records.isFetching} onPress={() => void records.refetch()} />}>
        <View style={downloadStyles.statGrid}>
          <StatTile label="本页记录" value={`${items.length}`} />
          <StatTile label="来源" value="后端记录" tone="info" />
        </View>
        <PrimaryButton label="清空记录" onPress={confirmClear} tone="danger" />
      </Card>
      {records.isLoading ? <LoadingState /> : null}
      {records.error ? <ErrorState message={(records.error as Error).message} onRetry={() => records.refetch()} /> : null}
      {!records.isLoading && !records.error && !items.length ? <EmptyState label="暂无下载记录" /> : null}
      {items.map((item, index) => {
        const record = asRecord(item);
        const title = taskTitle(record) || `记录 ${index + 1}`;
        const status = taskStatusKey(record);
        return (
          <Card key={String(record.id || record.code || record.url || index)} variant="strong" style={downloadStyles.taskCard}>
            <View style={downloadStyles.taskHeader}>
              <View style={downloadStyles.taskTitleWrap}>
                <StatusDot statusKey={status} />
                <View style={downloadStyles.taskTitleTextWrap}>
                  <Text style={[downloadStyles.taskTitle, {color: colors.text}]} numberOfLines={2}>
                    {title}
                  </Text>
                  <View style={downloadStyles.badgeRow}>
                    <Badge label={taskStatusLabel(status, 'pan115')} tone={taskBadgeTone(status)} />
                    {textFrom(record, ['downloader']) ? <Badge label={textFrom(record, ['downloader'])} tone="info" /> : null}
                  </View>
                </View>
              </View>
            </View>
            <View style={downloadStyles.metricGrid}>
              <TaskMetric icon={Download} label="番号/资源" value={textFrom(record, ['code', 'video_code', 'url'], '-')} />
              <TaskMetric icon={Cloud} label="保存路径" value={textFrom(record, ['save_path', 'savePath', 'path'], '-')} />
              <TaskMetric icon={ListOrdered} label="记录时间" value={formatTimeValue(record.created_at || record.createdAt || record.time)} tone="warning" />
            </View>
            <Text style={[downloadStyles.recordSummary, {color: colors.mutedText}]}>{summarizeRecord(item)}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}

const downloadStyles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  downloaderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  downloaderMessage: {
    fontSize: 13,
    lineHeight: 20,
  },
  downloaderName: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 11,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  listWrap: {
    gap: 14,
  },
  metric: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
    minHeight: 68,
    padding: 10,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  progressBlock: {
    gap: 7,
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  progressMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 8,
    overflow: 'hidden',
  },
  recordSummary: {
    fontSize: 12,
    lineHeight: 19,
  },
  roundButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.36,
    shadowRadius: 10,
    width: 34,
  },
  screenHint: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  screenTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statTile: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '30%',
    flexGrow: 1,
    gap: 5,
    minHeight: 58,
    padding: 10,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  statusDot: {
    borderRadius: 999,
    height: 9,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.8,
    shadowRadius: 8,
    width: 9,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  taskCard: {
    gap: 14,
  },
  taskHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  taskTitleTextWrap: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  taskTitleWrap: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minWidth: 0,
    paddingTop: 3,
  },
});
