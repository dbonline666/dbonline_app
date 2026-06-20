import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
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

const taskTitle = (record: Record<string, unknown>) =>
  String(record.name || record.title || record.filename || record.hash || record.gid || record.id || '任务');

const taskId = (record: Record<string, unknown>, mode: DownloadMode) => {
  if (mode === 'aria2') {
    return String(record.gid || record.id || '').trim();
  }
  if (mode === 'qb') {
    return String(record.hash || record.id || '').trim();
  }
  return String(record.id || '').trim();
};

const primaryTaskAction = (record: Record<string, unknown>, mode: DownloadMode) => {
  const state = String(record.status_key || record.statusKey || record.status || record.state || '').toLowerCase();
  if (mode === 'qb') {
    return state.startsWith('paused') || state.startsWith('stopped') ? 'resume' : 'pause';
  }
  if (mode === 'aria2') {
    if (state === 'paused') return 'resume';
    if (state === 'active' || state === 'waiting' || state === 'downloading') return 'pause';
  }
  if (mode === 'thunder') {
    if (state === 'paused') return 'resume';
    if (state === 'downloading' || state === 'waiting') return 'pause';
  }
  return '';
};

function DownloadTaskList({mode, queryFn}: {mode: DownloadMode; queryFn: () => Promise<unknown>}) {
  const {api} = useAppState();
  const colors = useAppColors();
  const query = useQuery({queryKey: ['download-tasks', mode], queryFn});
  const items = extractList(query.data);

  const runAction = async (record: Record<string, unknown>, action: string) => {
    const id = taskId(record, mode);
    if (!id) {
      Alert.alert('任务操作失败', '当前任务缺少 ID');
      return;
    }

    try {
      if (mode === 'aria2') {
        await api.aria2Action({action, gid: id});
      } else if (mode === 'qb') {
        await api.qbittorrentAction({action, hash: id, ...(action === 'delete' ? {delete_files: false} : {})});
      } else if (mode === 'thunder') {
        await api.thunderAction({
          action,
          id,
          type: String(record.type || 'user#download-url'),
        });
      }
      await query.refetch();
    } catch (error) {
      Alert.alert('任务操作失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  if (query.isLoading) {
    return <LoadingState />;
  }
  if (query.error) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  if (!items.length) {
    return <EmptyState />;
  }

  return (
    <Screen>
      {items.map((item, index) => {
        const record = item as Record<string, unknown>;
        const action = primaryTaskAction(record, mode);
        const actionable = mode === 'aria2' || mode === 'qb' || mode === 'thunder';
        return (
          <Card key={taskId(record, mode) || index} title={taskTitle(record)}>
            <Text style={{color: colors.mutedText, lineHeight: 22}}>{summarizeRecord(item)}</Text>
            {actionable ? (
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 18}}>
                {action ? (
                  <TextButton
                    label={action === 'resume' ? '恢复' : '暂停'}
                    onPress={() => runAction(record, action)}
                  />
                ) : null}
                <TextButton label="删除任务" onPress={() => runAction(record, 'delete')} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

export function DownloadTasksScreen() {
  const {api} = useAppState();
  const [mode, setMode] = useState<DownloadMode>('downloaders');
  const queryMap: Record<DownloadMode, () => Promise<unknown>> = {
    downloaders: () => api.getDownloaders(),
    aria2: api.aria2Tasks,
    qb: () => api.qbittorrentTasks('all'),
    thunder: api.thunderTasks,
    pan115: () => api.pan115Tasks(),
  };
  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: 16}}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            {label: '下载器', value: 'downloaders'},
            {label: 'Aria2', value: 'aria2'},
            {label: 'qB', value: 'qb'},
            {label: '迅雷', value: 'thunder'},
            {label: '115', value: 'pan115'},
          ]}
        />
      </View>
      <DownloadTaskList mode={mode} queryFn={queryMap[mode]} />
    </Screen>
  );
}

export function DownloadRecordsScreen() {
  const {api} = useAppState();
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

  return (
    <Screen>
      <PrimaryButton label="清空记录" onPress={clear} tone="danger" />
      {records.isLoading ? <LoadingState /> : null}
      {records.error ? <ErrorState message={(records.error as Error).message} onRetry={() => records.refetch()} /> : null}
      {extractList(records.data).map((item, index) => (
        <Card key={index} title={`记录 ${index + 1}`}>
          <Text>{summarizeRecord(item)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
