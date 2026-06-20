import React, {ReactNode, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  Bell,
  Database,
  Download,
  Film,
  History,
  ListOrdered,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {
  Card,
  ErrorState,
  Field,
  LoadingState,
  PrimaryButton,
  Screen,
  SectionTitle,
  useAppColors,
} from '../components/ui';
import {VideoGrid} from '../components/VideoList';
import {useAppState} from '../state/AppState';
import {useSchedulerSocket} from '../services/schedulerSocket';
import type {RootStackParamList} from '../navigation/types';
import {extractList} from '../services/api/endpoints';
import {normalizeVideo} from '../utils/data';
import {radius, spacing} from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type IconComponent = React.ComponentType<{color?: string; size?: number; strokeWidth?: number}>;

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const dataRecord = (value: unknown) => {
  const record = toRecord(value);
  const data = toRecord(record.data);
  return Object.keys(data).length ? data : record;
};

const nestedRecord = (record: Record<string, unknown>, key: string) => toRecord(record[key]);

const pickText = (record: Record<string, unknown>, keys: string[], fallback = '---') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'ready' : 'disabled';
    }
  }
  return fallback;
};

const formatNumber = (value: unknown) => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number.toLocaleString() : '---';
};

const formatBytes = (value: unknown) => {
  const bytes = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '---';
  }
  const mb = bytes / 1024 / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`;
};

const formatMemory = (value: unknown) => {
  const mb = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(mb) || mb <= 0) {
    return '---';
  }
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`;
};

const checkTone = (status: unknown): 'success' | 'warning' | 'danger' => {
  const text = String(status || '').toLowerCase();
  if (!text) {
    return 'warning';
  }
  if (text.includes('error') || text.includes('unhealthy') || text.includes('blocked') || text.includes('not ready')) {
    return 'danger';
  }
  if (text.includes('not configured') || text.includes('disabled') || text.includes('not running')) {
    return 'warning';
  }
  return 'success';
};

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const {api, serverConfig, token} = useAppState();
  const colors = useAppColors();
  const [queuedTaskId, setQueuedTaskId] = useState('');
  const health = useQuery({queryKey: ['health'], queryFn: api.getHealth});
  const ready = useQuery({queryKey: ['ready'], queryFn: api.getReady});
  const metrics = useQuery({queryKey: ['metrics'], queryFn: api.getMetrics, enabled: !!token});
  const stats = useQuery({queryKey: ['stats'], queryFn: api.getStats, enabled: !!token});
  const recent = useQuery({
    queryKey: ['home-latest', 'update'],
    queryFn: () => api.getLatestMovies({page: 1, limit: 9, type: 'all', sort: 'update', sort_by: 'update', filter_by: 'magnets'}),
    enabled: !!token,
  });
  const latest = useQuery({
    queryKey: ['home-latest', 'release'],
    queryFn: () => api.getLatestMovies({page: 1, limit: 9, type: 'all', sort: 'release', sort_by: 'release', filter_by: 'magnets'}),
    enabled: !!token,
  });
  const recommend = useQuery({
    queryKey: ['recommend'],
    queryFn: () => api.getRecommendMovies(1, 9),
    enabled: !!token,
  });
  const scheduler = useSchedulerSocket(serverConfig, !!token);

  if (health.isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (health.error) {
    return (
      <Screen>
        <ErrorState message={(health.error as Error).message} onRetry={() => health.refetch()} />
      </Screen>
    );
  }

  const healthRecord = dataRecord(health.data);
  const readyRecord = dataRecord(ready.data);
  const metricsRecord = dataRecord(metrics.data);
  const statsRecord = dataRecord(stats.data);
  const healthChecks = nestedRecord(healthRecord, 'checks');
  const readyChecks = nestedRecord(readyRecord, 'checks');
  const mode = pickText(healthRecord, ['mode', 'status'], 'online');
  const statusTone = health.error ? 'danger' : mode === 'degraded-online-only' ? 'warning' : 'success';
  const recentItems = extractList(recent.data).map(item => normalizeVideo(item, serverConfig));
  const latestItems = extractList(latest.data).map(item => normalizeVideo(item, serverConfig));
  const recommended = extractList(recommend.data).map(item => normalizeVideo(item, serverConfig));
  const schedulerRecord = toRecord(scheduler.status);
  const schedulerTask = pickText(schedulerRecord, ['task', 'task_name', 'current_task', 'current_task_name', 'status'], scheduler.connected ? '已连接' : '未连接');

  const cancelScheduler = async () => {
    try {
      await api.cancelScheduler();
      Alert.alert('调度器', '已提交取消当前任务请求');
    } catch (error) {
      Alert.alert('取消失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const cancelQueuedTask = async () => {
    const taskId = queuedTaskId.trim();
    if (!taskId) {
      Alert.alert('调度器', '请输入队列任务 ID');
      return;
    }
    try {
      await api.cancelQueuedTask(taskId);
      setQueuedTaskId('');
      Alert.alert('调度器', '已提交取消队列任务请求');
    } catch (error) {
      Alert.alert('取消失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  return (
    <Screen>
      <Card variant="cyber" style={styles.hero}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleBlock}>
            <Text style={[styles.eyebrow, {color: colors.secondary}]}>DB ONLINE</Text>
            <Text style={[styles.heroTitle, {color: colors.text}]}>DB Online</Text>
          </View>
          <StatusPill label={mode} tone={statusTone} />
        </View>
        <Text style={[styles.heroCopy, {color: colors.mutedText}]} numberOfLines={2}>
          {serverConfig?.origin || '未配置后端地址'}
        </Text>
        <View style={styles.heroMetaGrid}>
          <MetaChip icon={<Zap color={colors.primary} size={14} />} label="调度器" value={schedulerTask} />
          <MetaChip icon={<Database color={colors.secondary} size={14} />} label="数据库" value={pickText(healthChecks, ['database'], '检查中')} />
          <MetaChip icon={<ShieldCheck color={colors.success} size={14} />} label="就绪" value={pickText(readyRecord, ['ready'], ready.isLoading ? '检查中' : 'ready')} />
        </View>
      </Card>

      <View style={styles.quickGrid}>
        <QuickAction icon={Film} label="最新影片" onPress={() => navigation.navigate('Latest')} />
        <QuickAction icon={Search} label="演员搜索" onPress={() => navigation.navigate('ActorSearch')} />
        <QuickAction icon={ListOrdered} label="排行榜" onPress={() => navigation.navigate('Rankings')} />
        <QuickAction icon={Users} label="筛选结果" onPress={() => navigation.navigate('Filter', {type: 'actor', value: ''})} />
        <QuickAction icon={Bell} label="订阅" onPress={() => navigation.navigate('MainTabs', {screen: 'Subscriptions'})} />
        <QuickAction icon={Star} label="已观看" onPress={() => navigation.navigate('Watched')} />
        <QuickAction icon={Sparkles} label="关注" onPress={() => navigation.navigate('Following')} />
        <QuickAction icon={Download} label="下载任务" onPress={() => navigation.navigate('DownloadTasks')} />
        <QuickAction icon={History} label="下载记录" onPress={() => navigation.navigate('DownloadRecords')} />
      </View>

      <VideoSection
        title="最近更新"
        loading={recent.isLoading}
        error={recent.error}
        items={recentItems}
        emptyLabel="暂无最近更新"
        onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
      />

      <VideoSection
        title="最新上架"
        loading={latest.isLoading}
        error={latest.error}
        items={latestItems}
        emptyLabel="暂无最新上架"
        onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
      />

      <VideoSection
        title="推荐"
        loading={recommend.isLoading}
        error={recommend.error}
        items={recommended}
        emptyLabel="暂无推荐内容"
        onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
      />

      <View style={styles.dashboard}>
        <Card title="系统状态" variant="cyber" style={styles.dashboardCard}>
          <HealthRow label="Database" value={pickText(healthChecks, ['database'], 'unknown')} />
          <HealthRow label="Media Library" value={pickText(nestedRecord(healthRecord, 'capabilities'), ['media_library'], 'unknown')} />
          <HealthRow label="Downloader" value={pickText(readyChecks, ['downloader'], 'unknown')} />
          <HealthRow label="Scheduler" value={pickText(readyChecks, ['scheduler'], 'unknown')} />
          <HealthRow label="Telegram" value={pickText(readyChecks, ['telegram'], 'unknown')} />
          <MetricLine label="内存" value={formatMemory(metricsRecord.memory_used_mb)} />
          <MetricLine label="数据库" value={formatBytes(metricsRecord.db_size_bytes)} />
        </Card>

        <Card title="统计" variant="cyber" style={styles.dashboardCard}>
          {stats.isLoading ? (
            <LoadingState label="统计加载中" />
          ) : stats.error ? (
            <Text style={[styles.muted, {color: colors.mutedText}]}>统计暂不可用</Text>
          ) : (
            <View style={styles.statGrid}>
              <StatTile label="影片" value={formatNumber(statsRecord.total_videos)} />
              <StatTile label="磁链影片" value={formatNumber(statsRecord.videos_with_magnets)} />
              <StatTile label="磁链" value={formatNumber(statsRecord.total_magnets)} />
              <StatTile label="演员" value={formatNumber(statsRecord.total_actors)} />
              <StatTile label="订阅" value={formatNumber(statsRecord.active_subscriptions)} />
              <StatTile label="黑名单" value={formatNumber(statsRecord.total_blacklist)} />
            </View>
          )}
        </Card>
      </View>

      <Card title="调度器控制" variant="strong">
        <View style={styles.schedulerActions}>
          <PrimaryButton label="取消当前任务" onPress={cancelScheduler} tone="neutral" />
          <Field label="队列任务 ID" value={queuedTaskId} onChangeText={setQueuedTaskId} placeholder="taskId" />
          <PrimaryButton label="取消队列任务" onPress={cancelQueuedTask} tone="danger" />
        </View>
      </Card>
    </Screen>
  );
}

function VideoSection({
  title,
  loading,
  error,
  items,
  emptyLabel,
  onPress,
}: {
  title: string;
  loading: boolean;
  error: unknown;
  items: ReturnType<typeof normalizeVideo>[];
  emptyLabel: string;
  onPress: (item: ReturnType<typeof normalizeVideo>) => void;
}) {
  const colors = useAppColors();
  return (
    <View style={styles.section}>
      <SectionTitle>{title}</SectionTitle>
      {loading ? (
        <LoadingState label={`${title}加载中`} />
      ) : error ? (
        <Text style={[styles.muted, {color: colors.mutedText}]}>{title}暂不可用</Text>
      ) : items.length ? (
        <VideoGrid items={items} onPress={onPress} />
      ) : (
        <Text style={[styles.muted, {color: colors.mutedText}]}>{emptyLabel}</Text>
      )}
    </View>
  );
}

function StatusPill({label, tone}: {label: string; tone: 'success' | 'warning' | 'danger'}) {
  const colors = useAppColors();
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.danger;
  const backgroundColor = tone === 'success' ? colors.successSoft : tone === 'warning' ? colors.warningSoft : colors.accentSoft;
  return (
    <View style={[styles.statusPill, {backgroundColor, borderColor: color}]}>
      <View style={[styles.statusDot, {backgroundColor: color}]} />
      <Text style={[styles.statusPillText, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function MetaChip({icon, label, value}: {icon: ReactNode; label: string; value: string}) {
  const colors = useAppColors();
  return (
    <View style={[styles.metaChip, {backgroundColor: colors.chipBg, borderColor: colors.panelBorder}]}>
      {icon}
      <View style={styles.metaChipText}>
        <Text style={[styles.metaLabel, {color: colors.mutedText}]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.metaValue, {color: colors.text}]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function QuickAction({icon: Icon, label, onPress}: {icon: IconComponent; label: string; onPress: () => void}) {
  const colors = useAppColors();
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.quickAction,
        {
          backgroundColor: pressed ? colors.primarySoft : colors.panel,
          borderColor: pressed ? colors.primary : colors.panelBorder,
          shadowColor: colors.shadow,
        },
      ]}>
      <Icon color={colors.primary} size={18} strokeWidth={2.2} />
      <Text style={[styles.quickLabel, {color: colors.text}]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HealthRow({label, value}: {label: string; value: string}) {
  const tone = checkTone(value);
  const colors = useAppColors();
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.danger;
  return (
    <View style={[styles.healthRow, {borderBottomColor: colors.panelBorder}]}>
      <Text style={[styles.healthLabel, {color: colors.secondaryText}]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.healthValue, {color}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MetricLine({label, value}: {label: string; value: string}) {
  const colors = useAppColors();
  return (
    <View style={styles.metricLine}>
      <Text style={[styles.metricLabel, {color: colors.mutedText}]}>{label}</Text>
      <Text style={[styles.metricValue, {color: colors.primary}]}>{value}</Text>
    </View>
  );
}

function StatTile({label, value}: {label: string; value: string}) {
  const colors = useAppColors();
  return (
    <View style={[styles.statTile, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      <Text style={[styles.statLabel, {color: colors.mutedText}]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, {color: colors.primary}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 170,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  heroTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  heroCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaChip: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexGrow: 1,
    flexBasis: '30%',
    gap: spacing.sm,
    minHeight: 46,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  metaChipText: {
    flex: 1,
    minWidth: 0,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    maxWidth: 150,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusPillText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 2,
    flexBasis: '31.8%',
    flexGrow: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 78,
    minWidth: 0,
    padding: spacing.sm,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.32,
    shadowRadius: 16,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  section: {
    gap: spacing.md,
  },
  dashboard: {
    gap: spacing.md,
  },
  dashboardCard: {
    minHeight: 210,
  },
  healthRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 31,
    gap: spacing.sm,
  },
  healthLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  healthValue: {
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'right',
  },
  metricLine: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 68,
    minWidth: 0,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  schedulerActions: {
    gap: spacing.md,
  },
  muted: {
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: spacing.xs,
  },
});
