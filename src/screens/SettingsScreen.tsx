import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  ArrowUpDown,
  Bell,
  ChevronRight,
  Clock,
  Cloud,
  Download,
  FileText,
  Film,
  FlaskConical,
  Globe,
  HardDrive,
  Info,
  Link,
  Lock,
  Play,
  Send,
  Settings as SettingsIcon,
  Tv,
  Wrench,
} from 'lucide-react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
  Badge,
  Card,
  ErrorState,
  Field,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  useAppColors,
} from '../components/ui';
import {useAppState} from '../state/AppState';
import type {AppLocale, JsonRecord, JsonValue, ThemeMode} from '../types';
import type {RootStackParamList} from '../navigation/types';
import {registerPasskey} from '../services/passkey';
import {asRecord, pickString, summarizeRecord, toJsonRecord} from '../utils/data';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSection'>;
type IconComponent = React.ComponentType<{color?: string; size?: number; strokeWidth?: number}>;
type SettingsGroupId = 'system' | 'download' | 'media' | 'notify' | 'other';
type SettingsBadgeTone = 'restart' | 'hot' | 'tool';

const settingsGroups: Array<{id: SettingsGroupId; title: string; description: string}> = [
  {id: 'system', title: '系统设置', description: '服务、鉴权、代理、订阅和 API'},
  {id: 'download', title: '下载设置', description: '下载器、网盘、资源源优先级'},
  {id: 'media', title: '媒体库设置', description: '媒体服务器、播放器、缓存和字幕'},
  {id: 'notify', title: '通知设置', description: 'Telegram、AI 和 Webhook'},
  {id: 'other', title: '其他', description: '维护、实验功能、日志和关于'},
];

const settingsSections: Array<{
  section: string;
  title: string;
  description: string;
  group: SettingsGroupId;
  icon: IconComponent;
  badge?: string;
  badgeTone?: SettingsBadgeTone;
}> = [
  {section: 'basic', title: '基础配置', description: '服务、数据库、界面和日志', group: 'system', icon: SettingsIcon, badge: '重启', badgeTone: 'restart'},
  {section: 'auth', title: '鉴权', description: '密码、TOTP、Passkey 和会话策略', group: 'system', icon: Lock, badge: '热更新', badgeTone: 'hot'},
  {section: 'proxy', title: '代理', description: '主程序与通知代理', group: 'system', icon: Globe, badge: '热更新', badgeTone: 'hot'},
  {section: 'subscription', title: '订阅', description: '自动同步、预设和订阅矩阵', group: 'system', icon: Bell, badge: '热更新', badgeTone: 'hot'},
  {section: 'api', title: 'API 与预设', description: 'JavDB、URL 替换和请求参数', group: 'system', icon: Link, badge: '热更新', badgeTone: 'hot'},
  {section: 'downloader', title: '下载器优先级', description: '下载器启用顺序和禁用列表', group: 'download', icon: ArrowUpDown, badge: '热更新', badgeTone: 'hot'},
  {section: 'resource-priority', title: '资源源优先级', description: '磁链、字幕和资源源顺序', group: 'download', icon: ArrowUpDown, badge: '热更新', badgeTone: 'hot'},
  {section: 'openlist', title: 'OpenList', description: 'OpenList 上传、路径和删除策略', group: 'download', icon: HardDrive, badge: '热更新', badgeTone: 'hot'},
  {section: 'clouddrive2', title: 'CloudDrive2', description: 'CloudDrive2 连接和保存路径', group: 'download', icon: HardDrive, badge: '热更新', badgeTone: 'hot'},
  {section: 'pan115', title: '115 网盘', description: 'Cookie、目录、配额和任务', group: 'download', icon: Cloud, badge: '热更新', badgeTone: 'hot'},
  {section: 'aria2', title: 'Aria2', description: 'RPC、密钥、保存路径和任务', group: 'download', icon: Download, badge: '热更新', badgeTone: 'hot'},
  {section: 'qbittorrent', title: 'qBittorrent', description: '连接、分类、保存路径和任务', group: 'download', icon: Download, badge: '热更新', badgeTone: 'hot'},
  {section: 'thunder', title: '迅雷', description: '设备、目录和下载任务', group: 'download', icon: Download, badge: '热更新', badgeTone: 'hot'},
  {section: 'emby', title: 'Emby', description: 'Emby 服务器和媒体库', group: 'media', icon: Tv, badge: '热更新', badgeTone: 'hot'},
  {section: 'fnmedia', title: '飞牛影视', description: '飞牛影视连接和媒体库', group: 'media', icon: Film, badge: '热更新', badgeTone: 'hot'},
  {section: 'jellyfin', title: 'Jellyfin', description: 'Jellyfin 服务器和媒体库', group: 'media', icon: Film, badge: '热更新', badgeTone: 'hot'},
  {section: 'player', title: '播放器', description: '默认播放器、外部播放和串流', group: 'media', icon: Play, badge: '热更新', badgeTone: 'hot'},
  {section: 'library-cache', title: '媒体库缓存', description: '缓存统计、刷新和进度', group: 'media', icon: Clock, badge: '工具', badgeTone: 'tool'},
  {section: 'subtitle', title: '字幕', description: '扫描目录、后缀、下载和缓存', group: 'media', icon: FileText, badge: '热更新', badgeTone: 'hot'},
  {section: 'telegram', title: 'Telegram', description: '机器人、群组、模板和通知', group: 'notify', icon: Send, badge: '热更新', badgeTone: 'hot'},
  {section: 'ai', title: 'AI', description: '模型、API、工具轮次和连接测试', group: 'notify', icon: SettingsIcon, badge: '热更新', badgeTone: 'hot'},
  {section: 'webhook', title: 'Webhook', description: '入站白名单和联动策略', group: 'notify', icon: Link, badge: '热更新', badgeTone: 'hot'},
  {section: 'extended_magnet', title: '扩展磁链库', description: '内置磁链和自定义库', group: 'other', icon: Link, badge: '热更新', badgeTone: 'hot'},
  {section: 'maintenance', title: '维护', description: '缓存、黑名单和清理工具', group: 'other', icon: Wrench, badge: '工具', badgeTone: 'tool'},
  {section: 'experimental', title: '实验功能', description: '同步、Webhook 和实验开关', group: 'other', icon: FlaskConical, badge: '热更新', badgeTone: 'hot'},
  {section: 'app-log', title: '应用日志', description: '查看后端应用日志', group: 'other', icon: FileText, badge: '工具', badgeTone: 'tool'},
  {section: 'subscription-log', title: '订阅日志', description: '查看和清理订阅日志', group: 'other', icon: FileText, badge: '工具', badgeTone: 'tool'},
  {section: 'about', title: '关于', description: '版本和项目状态', group: 'other', icon: Info, badge: '信息', badgeTone: 'tool'},
];

const sectionConfigPaths: Record<string, string[][]> = {
  basic: [['ui'], ['server'], ['database'], ['log']],
  auth: [['auth']],
  proxy: [['proxy']],
  subscription: [['subscription'], ['auto_sync']],
  api: [['javdb_api'], ['image_cache']],
  downloader: [['downloader', 'priority'], ['downloader', 'disabled']],
  'resource-priority': [
    ['subscription', 'resource_source_priority'],
    ['external_magnet', 'custom_libraries'],
    ['external_magnet', 'builtin_magnets'],
    ['experimental', 'builtin_magnets_in_subscription'],
  ],
  openlist: [['downloader', 'openlist']],
  clouddrive2: [['downloader', 'clouddrive2']],
  pan115: [['downloader', 'pan115']],
  aria2: [['downloader', 'aria2']],
  qbittorrent: [['downloader', 'qbittorrent']],
  thunder: [['downloader', 'thunder']],
  emby: [['mediaserver', 'emby']],
  fnmedia: [['mediaserver', 'fnmedia']],
  jellyfin: [['mediaserver', 'jellyfin']],
  player: [['mediaserver', 'player']],
  'library-cache': [['mediaserver', 'library_cache_schedule']],
  subtitle: [['subtitle']],
  telegram: [['telegram']],
  ai: [['ai']],
  webhook: [['mediaserver', 'webhook']],
  extended_magnet: [['external_magnet']],
  experimental: [['experimental']],
};

const actionGroups: Record<string, {label: string; action: string; tone?: 'neutral' | 'danger'}[]> = {
  basic: [
    {label: '健康检查', action: 'health'},
    {label: '就绪状态', action: 'ready'},
    {label: '运行指标', action: 'metrics'},
  ],
  auth: [
    {label: '鉴权状态', action: 'authStatus'},
    {label: '验证会话', action: 'authVerify'},
    {label: '开始 TOTP 配置', action: 'totpBegin'},
    {label: '完成 TOTP 配置', action: 'totpFinish'},
    {label: 'Passkey 注册参数', action: 'passkeyRegisterBegin'},
    {label: '注册 Passkey', action: 'passkeyRegister'},
    {label: '完成 Passkey 注册', action: 'passkeyRegisterFinish'},
    {label: 'Passkey 登录参数', action: 'passkeyLoginBegin'},
    {label: '重命名 Passkey', action: 'passkeyCredentialRename'},
    {label: '删除 Passkey', action: 'passkeyCredentialDelete', tone: 'danger'},
    {label: '删除 TOTP', action: 'totpDelete', tone: 'danger'},
  ],
  api: [
    {label: '探测 URL 预设', action: 'probeUrlPresets'},
    {label: 'JavDB 登录令牌', action: 'javdbLogin'},
  ],
  downloader: [
    {label: '下载器列表', action: 'downloaders'},
    {label: '新建下载任务', action: 'download'},
  ],
  openlist: [
    {label: 'OpenList 连通测试', action: 'openlistTest'},
    {label: 'OpenList 工具路径', action: 'openlistToolPaths'},
  ],
  clouddrive2: [{label: 'CloudDrive2 连通测试', action: 'clouddrive2Test'}],
  pan115: [
    {label: '115 连通测试', action: 'pan115Test'},
    {label: '115 任务', action: 'pan115Tasks'},
    {label: '115 目录', action: 'pan115Directories'},
  ],
  aria2: [
    {label: 'Aria2 任务', action: 'aria2Tasks'},
    {label: 'Aria2 连通测试', action: 'aria2Test'},
  ],
  qbittorrent: [
    {label: 'qBittorrent 任务', action: 'qbittorrentTasks'},
    {label: 'qBittorrent 连通测试', action: 'qbittorrentTest'},
  ],
  thunder: [
    {label: '迅雷任务', action: 'thunderTasks'},
    {label: '迅雷连通测试', action: 'thunderTest'},
    {label: '迅雷选择项', action: 'thunderSelectOptions'},
    {label: '迅雷探测记录', action: 'thunderReviewProbeHistory'},
  ],
  emby: [
    {label: 'Emby 连通测试', action: 'embyTest'},
    {label: 'Emby 媒体库', action: 'embyLibraries'},
  ],
  fnmedia: [
    {label: '飞牛影视连通测试', action: 'fnmediaTest'},
    {label: '飞牛影视媒体库', action: 'fnmediaLibraries'},
  ],
  jellyfin: [
    {label: 'Jellyfin 连通测试', action: 'jellyfinTest'},
    {label: 'Jellyfin 媒体库', action: 'jellyfinLibraries'},
  ],
  player: [
    {label: '读取播放器配置', action: 'player'},
    {label: '更新播放器配置', action: 'updatePlayer'},
  ],
  'library-cache': [
    {label: '缓存统计', action: 'libraryCacheStats'},
    {label: '刷新缓存', action: 'refreshLibraryCache'},
    {label: '刷新进度', action: 'libraryCacheProgress'},
  ],
  subtitle: [
    {label: '字幕统计', action: 'subtitleStats'},
    {label: '扫描字幕', action: 'scanSubtitles'},
    {label: '扫描进度', action: 'subtitleProgress'},
    {label: '字幕下载地址', action: 'subtitleDownloadUrl'},
    {label: '下载字幕', action: 'downloadSubtitle'},
    {label: '下载外部字幕', action: 'downloadExternalSubtitle'},
    {label: '清理字幕缓存', action: 'clearSubtitleCache', tone: 'danger'},
  ],
  telegram: [{label: '测试 Telegram 通知', action: 'telegramTest'}],
  ai: [
    {label: '测试 AI 连接', action: 'aiTest'},
    {label: '列出 AI 模型', action: 'aiModels'},
  ],
  extended_magnet: [{label: '扩展磁链库统计', action: 'customMagnetStats'}],
  maintenance: [
    {label: '图片缓存统计', action: 'imageStats'},
    {label: '清理图片缓存', action: 'clearImageCache', tone: 'danger'},
    {label: '黑名单列表', action: 'blacklist'},
    {label: '加入黑名单', action: 'addToBlacklist'},
    {label: '移出黑名单', action: 'removeFromBlacklist'},
    {label: '批量移出黑名单', action: 'batchRemoveFromBlacklist'},
    {label: '测试黑名单', action: 'testBlacklist'},
  ],
  'app-log': [{label: '读取日志', action: 'logs'}],
  'subscription-log': [
    {label: '订阅日志', action: 'subscriptionLogs'},
    {label: '清理订阅日志', action: 'clearSubscriptionLogs', tone: 'danger'},
  ],
  subscription: [
    {label: '订阅矩阵', action: 'subscriptionMatrix'},
    {label: '自动同步状态', action: 'autoSyncStatus'},
  ],
};

const jsonField = (payload: JsonRecord, keys: string[]) => {
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

const jsonArray = (payload: JsonRecord, key: string) => {
  const value = payload[key];
  return Array.isArray(value)
    ? value.map(item => String(item).trim()).filter(Boolean)
    : [];
};

const webAuthnBeginPayload = (payload: unknown) => {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const sessionId =
    pickString(record, ['session_id', 'sessionId']) ||
    pickString(data, ['session_id', 'sessionId']);
  const publicKeyFromRoot = asRecord(record.publicKey);
  const publicKeyFromData = asRecord(data.publicKey);
  const optionsFromRoot = asRecord(record.options);
  const optionsFromData = asRecord(data.options);
  const publicKey = publicKeyFromRoot.challenge
    ? publicKeyFromRoot
    : publicKeyFromData.challenge
      ? publicKeyFromData
      : Object.keys(optionsFromRoot).length
        ? optionsFromRoot
        : optionsFromData;
  if (!sessionId || !Object.keys(publicKey).length) {
    throw new Error(`后端未返回可用的 Passkey 参数：${summarizeRecord(payload)}`);
  }
  return {sessionId, publicKey: publicKey as JsonRecord};
};

type ConfigField = {
  key: string;
  path: string[];
  label: string;
  value: JsonValue;
  kind: 'string' | 'number' | 'boolean' | 'complex' | 'null';
};

const fieldNameMap: Record<string, string> = {
  api_key: 'API Key',
  ai: 'AI',
  auto_sync: '自动同步',
  base_url: 'Base URL',
  bot_token: 'Bot Token',
  builtin_magnets: '内置磁链',
  builtin_magnets_in_subscription: '订阅检查使用内置磁链',
  category: '分类',
  chat_id: 'Chat ID',
  cid: '目录 ID',
  clouddrive2: 'CloudDrive2',
  cleanup_hours: '清理间隔',
  cookie: 'Cookie',
  custom_libraries: '自定义库',
  database: '数据库配置',
  dbname: '数据库名',
  delete_policy: '删除策略',
  device_target: '设备',
  directories: '扫描目录',
  disabled: '禁用项',
  downloader: '下载器',
  external_magnet: '扩展磁链库',
  enabled: '启用',
  extensions: '后缀',
  experimental: '实验功能',
  host: '主机',
  image_cache: '图片缓存',
  javdb_api: 'JavDB API',
  library_ids: '媒体库',
  library_cache_schedule: '媒体库缓存计划',
  log: '日志配置',
  lock_minutes: '锁定分钟',
  max_failed_attempts: '最大失败次数',
  mediaserver: '媒体服务器',
  model: '模型',
  notify_template: '通知模板',
  parent_folder_id: '父目录',
  password: '密码',
  port: '端口',
  priority: '优先级',
  provider: '提供方',
  save_path: '保存路径',
  scan_interval: '扫描间隔',
  secret: '密钥',
  server: '服务配置',
  sslmode: 'SSL 模式',
  subscription: '订阅配置',
  subtitle: '字幕',
  telegram: 'Telegram',
  timeout: '超时',
  token: '令牌',
  token_expire_hours: 'Token 有效期',
  ui: '界面设置',
  use_https: 'HTTPS',
  user: '用户名',
  username: '用户名',
  webhook: 'Webhook',
  write_file: '写入文件',
};

const labelForPath = (path: string[]) =>
  path
    .map(item => fieldNameMap[item] || item.replace(/_/g, ' '))
    .join(' / ');

const isPlainObject = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const fieldKind = (value: JsonValue): ConfigField['kind'] => {
  if (value === null) return 'null';
  if (Array.isArray(value) || typeof value === 'object') return 'complex';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
};

const flattenConfigFields = (value: JsonValue, path: string[] = []): ConfigField[] => {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length || path.length === 0) {
      return entries.flatMap(([key, child]) => flattenConfigFields(child as JsonValue, [...path, key]));
    }
  }

  const key = path.join('.');
  return [{
    key,
    path,
    label: labelForPath(path),
    value,
    kind: fieldKind(value),
  }];
};

const getNestedConfigValue = (record: JsonRecord, path: string[]): JsonValue | undefined => {
  let cursor: JsonValue | undefined = record;
  for (const part of path) {
    if (!isPlainObject(cursor) || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
};

const flattenSectionConfigFields = (record: JsonRecord, section: string): ConfigField[] => {
  const paths = sectionConfigPaths[section] || [];
  return paths.flatMap(path => {
    const value = getNestedConfigValue(record, path);
    return value === undefined ? [] : flattenConfigFields(value, path);
  });
};

const valuesEqual = (left: JsonValue, right: JsonValue) =>
  JSON.stringify(left) === JSON.stringify(right);

const valueToDraft = (value: JsonValue) => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
};

const parseDraftValue = (field: ConfigField, raw: string): JsonValue => {
  if (field.kind === 'boolean') {
    return raw === 'true';
  }
  if (field.kind === 'number') {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${field.label} 必须是数字`);
    }
    return parsed;
  }
  if (field.kind === 'complex') {
    return (raw.trim() ? JSON.parse(raw) : (Array.isArray(field.value) ? [] : {})) as JsonValue;
  }
  if (field.kind === 'null') {
    return raw.trim() ? (JSON.parse(raw) as JsonValue) : null;
  }
  return raw;
};

const setNestedValue = (target: JsonRecord, path: string[], value: JsonValue) => {
  let cursor: JsonRecord = target;
  path.forEach((part, index) => {
    if (index === path.length - 1) {
      cursor[part] = value;
      return;
    }
    const next = cursor[part];
    if (!isPlainObject(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as JsonRecord;
  });
};

const badgeTone = (tone?: SettingsBadgeTone): 'neutral' | 'success' | 'warning' | 'info' =>
  tone === 'restart' ? 'warning' : tone === 'hot' ? 'success' : tone === 'tool' ? 'info' : 'neutral';

function SettingsMetric({label, value, tone = 'neutral'}: {label: string; value: string; tone?: 'neutral' | 'success' | 'warning' | 'info'}) {
  const colors = useAppColors();
  const color =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'info'
          ? colors.primary
          : colors.secondaryText;
  return (
    <View style={[styles.metricTile, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      <Text style={[styles.metricLabel, {color: colors.mutedText}]}>{label}</Text>
      <Text style={[styles.metricValue, {color}]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SectionRow({section, onPress}: {section: (typeof settingsSections)[number]; onPress: () => void}) {
  const colors = useAppColors();
  const Icon = section.icon;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.sectionRow,
        {
          backgroundColor: pressed ? colors.panelHover : colors.inputBg,
          borderColor: colors.panelBorder,
        },
      ]}>
      <View style={[styles.sectionIcon, {backgroundColor: colors.primarySoft, borderColor: colors.primary}]}>
        <Icon size={17} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.sectionText}>
        <View style={styles.sectionTitleLine}>
          <Text style={[styles.sectionTitleText, {color: colors.text}]} numberOfLines={1}>
            {section.title}
          </Text>
          {section.badge ? <Badge label={section.badge} tone={badgeTone(section.badgeTone)} /> : null}
        </View>
        <Text style={[styles.sectionDescription, {color: colors.mutedText}]} numberOfLines={2}>
          {section.description}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.mutedText} />
    </Pressable>
  );
}

function ConfigFieldEditor({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: string;
  onChange: (value: string) => void;
}) {
  const colors = useAppColors();
  if (field.kind === 'boolean') {
    return (
      <View style={[styles.booleanField, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
        <Text style={[styles.booleanFieldLabel, {color: colors.mutedText}]}>{field.label}</Text>
        <SegmentedControl<'true' | 'false'>
          value={value === 'true' ? 'true' : 'false'}
          onChange={onChange}
          options={[
            {label: '启用', value: 'true'},
            {label: '关闭', value: 'false'},
          ]}
        />
      </View>
    );
  }

  return (
    <Field
      label={field.label}
      value={value}
      onChangeText={onChange}
      keyboardType={field.kind === 'number' ? 'numeric' : undefined}
      multiline={field.kind === 'complex' || field.kind === 'null'}
    />
  );
}

function EmptyConfigState() {
  const colors = useAppColors();
  return (
    <View style={[styles.emptyBox, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      <Text style={[styles.emptyTitle, {color: colors.text}]}>工具分区</Text>
      <Text style={[styles.emptyText, {color: colors.mutedText}]}>
        当前分区没有独立配置字段，使用下方快捷操作查看状态或执行维护任务。
      </Text>
    </View>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<Navigation>();
  const {
    api,
    clearServer,
    serverConfig,
    setSessionToken,
    themeMode,
    setThemeMode,
    locale,
    setLocale,
  } = useAppState();
  const colors = useAppColors();
  const authStatus = useQuery({queryKey: ['auth-status-settings'], queryFn: api.authStatus});
  const authRecord = asRecord(authStatus.data);
  const configured = authRecord.configured === true || authRecord.enabled === true;

  const logout = async () => {
    try {
      await api.authLogout();
    } catch {
      // 后端登出失败不影响本地会话清理
    }
    await setSessionToken(null);
  };

  return (
    <Screen>
      <Card variant="cyber" title="设置中心">
        <View style={styles.heroMetrics}>
          <SettingsMetric label="服务器" value={serverConfig?.origin || '未配置'} tone={serverConfig ? 'success' : 'warning'} />
          <SettingsMetric label="鉴权" value={configured ? '已启用' : '未启用'} tone={configured ? 'success' : 'neutral'} />
          <SettingsMetric label="设置分区" value={`${settingsSections.length}`} tone="info" />
        </View>
        <View style={styles.heroActions}>
          <PrimaryButton label="退出登录" onPress={logout} tone="neutral" />
          <PrimaryButton label="重置服务器" onPress={clearServer} tone="danger" />
        </View>
      </Card>

      <Card title="显示偏好" action={<Badge label={locale} tone="info" />}>
        <SegmentedControl<ThemeMode>
          value={themeMode}
          onChange={setThemeMode}
          options={[
            {label: '系统', value: 'system'},
            {label: '浅色', value: 'light'},
            {label: '深色', value: 'dark'},
          ]}
        />
        <SegmentedControl<AppLocale>
          value={locale}
          onChange={setLocale}
          options={[
            {label: '简中', value: 'zh-CN'},
            {label: '繁中', value: 'zh-TW'},
            {label: 'EN', value: 'en-US'},
            {label: '日本語', value: 'ja-JP'},
          ]}
        />
      </Card>

      {settingsGroups.map(group => {
        const sections = settingsSections.filter(section => section.group === group.id);
        return (
          <Card
            key={group.id}
            title={group.title}
            action={<Badge label={`${sections.length} 项`} tone="secondary" />}
            variant={group.id === 'system' ? 'cyber' : 'default'}>
            <Text style={[styles.groupDescription, {color: colors.mutedText}]}>{group.description}</Text>
            <View style={styles.sectionList}>
              {sections.map(section => (
                <SectionRow
                  key={section.section}
                  section={section}
                  onPress={() => navigation.navigate('SettingsSection', {section: section.section, title: section.title})}
                />
              ))}
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

export function SettingsSectionScreen({route}: Props) {
  const {api} = useAppState();
  const colors = useAppColors();
  const section = route.params.section;
  const sectionMeta = settingsSections.find(item => item.section === section);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [actionPayloadJson, setActionPayloadJson] = useState('{}');
  const config = useQuery({
    queryKey: ['config', section],
    queryFn: () => api.getConfig(),
  });
  const configFields = useMemo(
    () => flattenSectionConfigFields(toJsonRecord(config.data), section),
    [config.data, section],
  );
  const actionItems = actionGroups[section] || [];
  const hasConfigEditor = configFields.length > 0;

  useEffect(() => {
    const next: Record<string, string> = {};
    configFields.forEach(field => {
      next[field.key] = valueToDraft(field.value);
    });
    setDraftValues(next);
  }, [configFields]);

  const saveConfig = async () => {
    try {
      const payload: JsonRecord = {};
      configFields.forEach(field => {
        const nextValue = parseDraftValue(field, draftValues[field.key] ?? valueToDraft(field.value));
        if (!valuesEqual(field.value, nextValue)) {
          setNestedValue(payload, field.path, nextValue);
        }
      });
      if (!Object.keys(payload).length) {
        Alert.alert('设置', hasConfigEditor ? '没有配置变更' : '当前分区没有可保存的配置');
        return;
      }
      await api.updateConfig(payload);
      Alert.alert('设置', '配置已保存');
      await config.refetch();
    } catch (error) {
      Alert.alert('保存失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const runAction = async (action: string) => {
    try {
      const payload = actionPayloadJson.trim()
        ? toJsonRecord(JSON.parse(actionPayloadJson))
        : {};
      const actions: Record<string, () => Promise<unknown>> = {
        health: api.health,
        ready: api.ready,
        metrics: api.metrics,
        authStatus: api.authStatus,
        authVerify: api.authVerify,
        totpBegin: api.authTOTPBegin,
        totpFinish: () => api.authTOTPFinish(payload),
        totpDelete: api.authTOTPDelete,
        passkeyRegisterBegin: () => api.authWebAuthnRegisterBegin(payload),
        passkeyRegister: async () => {
          const begin = await api.authWebAuthnRegisterBegin(payload);
          const {sessionId, publicKey} = webAuthnBeginPayload(begin);
          const credential = await registerPasskey(publicKey);
          return api.authWebAuthnRegisterFinish(
            sessionId,
            credential,
            typeof payload.name === 'string' ? payload.name : 'iOS Passkey',
          );
        },
        passkeyRegisterFinish: () =>
          api.authWebAuthnRegisterFinish(
            jsonField(payload, ['session_id', 'sessionId']),
            payload,
            typeof payload.name === 'string' ? payload.name : '',
          ),
        passkeyCredentialDelete: () =>
          api.authWebAuthnCredentialDelete(jsonField(payload, ['id', 'credential_id', 'credentialId'])),
        passkeyCredentialRename: () =>
          api.authWebAuthnCredentialRename(jsonField(payload, ['id', 'credential_id', 'credentialId']), payload),
        passkeyLoginBegin: api.authWebAuthnLoginBegin,
        probeUrlPresets: () => api.probeUrlPresets(jsonArray(payload, 'urls')),
        javdbLogin: () => api.javdbLogin(payload),
        downloaders: () => api.getDownloaders(),
        download: () => api.download(payload),
        openlistTest: () => api.openlistTest(payload),
        openlistToolPaths: () => api.openlistToolPaths(payload),
        clouddrive2Test: () => api.clouddrive2Test(payload),
        pan115Test: () => api.pan115Test(payload),
        pan115Tasks: () => api.pan115Tasks(),
        pan115Directories: () => api.pan115GetDirectories(payload),
        aria2Tasks: api.aria2Tasks,
        aria2Test: () => api.aria2Test(payload),
        qbittorrentTasks: () => api.qbittorrentTasks('all'),
        qbittorrentTest: () => api.qbittorrentTest(payload),
        thunderTasks: api.thunderTasks,
        thunderTest: () => api.thunderTest(payload),
        thunderSelectOptions: () => api.thunderSelectOptions(payload),
        thunderReviewProbeHistory: api.thunderReviewProbeHistory,
        embyTest: () => api.embyTest(payload),
        embyLibraries: () => api.embyGetLibraries(payload),
        fnmediaTest: () => api.fnmediaTest(payload),
        fnmediaLibraries: () => api.fnmediaGetLibraries(payload),
        jellyfinTest: () => api.jellyfinTest(payload),
        jellyfinLibraries: () => api.jellyfinGetLibraries(payload),
        player: api.getPlayerConfig,
        updatePlayer: () => api.updatePlayerConfig(payload),
        libraryCacheStats: api.getLibraryCacheStats,
        refreshLibraryCache: api.refreshLibraryCache,
        libraryCacheProgress: api.getLibraryCacheRefreshProgress,
        logs: () => api.getAppLog({limit: 100}),
        imageStats: api.getImageCacheStats,
        clearImageCache: api.clearImageCache,
        subtitleStats: api.getSubtitleStats,
        scanSubtitles: () => api.scanSubtitles('incremental'),
        subtitleProgress: api.getSubtitleProgress,
        subtitleDownloadUrl: () => Promise.resolve({url: api.getSubtitleDownloadUrl(jsonField(payload, ['id']))}),
        downloadSubtitle: () => api.downloadSubtitle(jsonField(payload, ['id'])),
        downloadExternalSubtitle: () =>
          api.downloadExternalSubtitle(
            jsonField(payload, ['url']),
            jsonField(payload, ['name']),
            jsonField(payload, ['ext']),
          ),
        clearSubtitleCache: api.clearSubtitleCache,
        blacklist: () => api.getBlacklist({page: 1, page_size: 50}),
        addToBlacklist: () => api.addToBlacklist(payload),
        removeFromBlacklist: () => api.removeFromBlacklist(jsonField(payload, ['video_code', 'code'])),
        batchRemoveFromBlacklist: () => api.batchRemoveFromBlacklist(jsonArray(payload, 'video_codes')),
        testBlacklist: () => api.testBlacklist(jsonArray(payload, 'video_codes')),
        telegramTest: api.telegramTestNotification,
        aiTest: () => api.aiTestConnection(payload),
        aiModels: () => api.aiListModels(payload),
        customMagnetStats: api.getCustomMagnetStats,
        subscriptionLogs: () => api.getSubscriptionLog({limit: 100}),
        clearSubscriptionLogs: () => api.clearSubscriptionLog(),
        subscriptionMatrix: () => api.getSubscriptionMatrix(),
        autoSyncStatus: api.getAutoSyncStatus,
      };
      if (!actions[action]) {
        throw new Error('当前操作未实现');
      }
      const result = await actions[action]();
      Alert.alert('执行结果', summarizeRecord(result));
    } catch (error) {
      Alert.alert('执行失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  if (config.isLoading) {
    return <LoadingState />;
  }

  if (config.error) {
    return <ErrorState message={(config.error as Error).message} onRetry={() => config.refetch()} />;
  }

  return (
    <Screen>
      <Card
        variant="cyber"
        title={route.params.title}
        action={sectionMeta?.badge ? <Badge label={sectionMeta.badge} tone={badgeTone(sectionMeta.badgeTone)} /> : null}>
        <Text style={[styles.groupDescription, {color: colors.mutedText}]}>
          {sectionMeta?.description || '配置当前分区并执行相关操作。'}
        </Text>
        <View style={styles.heroMetrics}>
          <SettingsMetric label="配置字段" value={`${configFields.length}`} tone="info" />
          <SettingsMetric label="快捷操作" value={`${actionItems.length}`} />
          <SettingsMetric label="保存方式" value={hasConfigEditor ? '仅变更' : '工具'} tone={hasConfigEditor ? 'success' : 'info'} />
        </View>
        {hasConfigEditor ? (
          <View style={styles.heroActions}>
            <PrimaryButton label="保存配置" onPress={saveConfig} />
            <PrimaryButton label="重新载入" onPress={() => config.refetch()} tone="neutral" />
          </View>
        ) : null}
      </Card>

      <Card title="配置字段">
        {configFields.length ? (
          <View style={styles.fieldList}>
            {configFields.map(field => (
              <ConfigFieldEditor
                key={field.key}
                field={field}
                value={draftValues[field.key] ?? valueToDraft(field.value)}
                onChange={value => setDraftValues(current => ({...current, [field.key]: value}))}
              />
            ))}
          </View>
        ) : (
          <EmptyConfigState />
        )}
      </Card>

      <Card
        title="快捷操作"
        action={actionItems.length ? <Badge label={`${actionItems.length} 项`} tone="info" /> : null}>
        <View style={styles.actionPanel}>
          <Field label="操作参数（可选 JSON）" value={actionPayloadJson} onChangeText={setActionPayloadJson} multiline />
          {actionItems.length ? (
            <View style={styles.actionGrid}>
              {actionItems.map(item => (
                <PrimaryButton
                  key={item.action}
                  label={item.label}
                  onPress={() => runAction(item.action)}
                  tone={item.tone || 'neutral'}
                />
              ))}
            </View>
          ) : (
            <Text style={[styles.groupDescription, {color: colors.mutedText}]}>当前分区没有额外快捷操作。</Text>
          )}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionGrid: {
    gap: 10,
  },
  actionPanel: {
    gap: 14,
  },
  booleanField: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
    padding: 12,
  },
  booleanFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    padding: 14,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  fieldList: {
    gap: 14,
  },
  groupDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroActions: {
    gap: 10,
  },
  heroMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricTile: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '30%',
    flexGrow: 1,
    gap: 5,
    minHeight: 58,
    padding: 10,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionList: {
    gap: 10,
  },
  sectionRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    padding: 12,
  },
  sectionText: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  sectionTitleLine: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitleText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
  },
});
