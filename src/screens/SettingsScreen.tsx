import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useQuery} from '@tanstack/react-query';
import {
  Card,
  ErrorState,
  Field,
  KeyValueRow,
  LoadingState,
  PrimaryButton,
  Screen,
  SegmentedControl,
  SectionTitle,
  useAppColors,
} from '../components/ui';
import {useAppState} from '../state/AppState';
import type {AppLocale, JsonRecord, ThemeMode} from '../types';
import type {RootStackParamList} from '../navigation/types';
import {registerPasskey} from '../services/passkey';
import {asRecord, pickString, summarizeRecord, toJsonRecord} from '../utils/data';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSection'>;

const settingsSections = [
  {section: 'basic', title: '基础配置'},
  {section: 'auth', title: '鉴权'},
  {section: 'proxy', title: '代理'},
  {section: 'subscription', title: '订阅'},
  {section: 'api', title: 'API 与预设'},
  {section: 'downloader', title: '下载器优先级'},
  {section: 'resource-priority', title: '资源源优先级'},
  {section: 'openlist', title: 'OpenList'},
  {section: 'clouddrive2', title: 'CloudDrive2'},
  {section: 'pan115', title: '115 网盘'},
  {section: 'aria2', title: 'Aria2'},
  {section: 'qbittorrent', title: 'qBittorrent'},
  {section: 'thunder', title: '迅雷'},
  {section: 'emby', title: 'Emby'},
  {section: 'fnmedia', title: '飞牛影视'},
  {section: 'jellyfin', title: 'Jellyfin'},
  {section: 'player', title: '播放器'},
  {section: 'library-cache', title: '媒体库缓存'},
  {section: 'subtitle', title: '字幕'},
  {section: 'telegram', title: 'Telegram'},
  {section: 'ai', title: 'AI'},
  {section: 'webhook', title: 'Webhook'},
  {section: 'extended_magnet', title: '扩展磁链库'},
  {section: 'maintenance', title: '维护'},
  {section: 'experimental', title: '实验功能'},
  {section: 'app-log', title: '应用日志'},
  {section: 'subscription-log', title: '订阅日志'},
  {section: 'about', title: '关于'},
];

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
      <Card title="服务器">
        <KeyValueRow label="地址" value={serverConfig?.origin || '未配置'} />
        <PrimaryButton label="重置服务器" onPress={clearServer} tone="danger" />
      </Card>

      <Card title="会话">
        <KeyValueRow label="鉴权" value={authStatus.data ? JSON.stringify(authStatus.data) : '未知'} />
        <PrimaryButton label="退出登录" onPress={logout} tone="neutral" />
      </Card>

      <Card title="显示">
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

      <SectionTitle>系统设置</SectionTitle>
      <Card>
        {settingsSections.map(section => (
          <KeyValueRow
            key={section.section}
            label={section.title}
            value="进入"
            onPress={() => navigation.navigate('SettingsSection', section)}
          />
        ))}
      </Card>

      <Text style={{color: colors.mutedText, lineHeight: 20}}>
        移动端保留现有后端配置合约。复杂配置以 JSON 方式编辑，避免移动端引入与网页重复的大型表单。
      </Text>
    </Screen>
  );
}

export function SettingsSectionScreen({route}: Props) {
  const {api} = useAppState();
  const colors = useAppColors();
  const section = route.params.section;
  const [configJson, setConfigJson] = useState('');
  const [actionPayloadJson, setActionPayloadJson] = useState('{}');
  const config = useQuery({
    queryKey: ['config', section],
    queryFn: () => api.getConfig({scope: section}),
  });

  React.useEffect(() => {
    if (config.data) {
      setConfigJson(JSON.stringify(config.data, null, 2));
    }
  }, [config.data]);

  const saveConfig = async () => {
    try {
      await api.updateConfig(JSON.parse(configJson) as JsonRecord);
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
      <Card title={route.params.title}>
        <Field label="配置 JSON" value={configJson} onChangeText={setConfigJson} multiline />
        <PrimaryButton label="保存配置" onPress={saveConfig} />
        <Text style={{color: colors.mutedText, lineHeight: 20}}>
          请只提交后端 `/api/config` 支持的字段；未知字段会由后端校验。
        </Text>
      </Card>

      <Card title="快捷操作">
        <View style={{gap: 10}}>
          <Field label="快捷操作参数 JSON" value={actionPayloadJson} onChangeText={setActionPayloadJson} multiline />
          {(actionGroups[section] || []).map(item => (
            <PrimaryButton
              key={item.action}
              label={item.label}
              onPress={() => runAction(item.action)}
              tone={item.tone || 'neutral'}
            />
          ))}
          {actionGroups[section]?.length ? null : (
            <Text style={{color: colors.mutedText, lineHeight: 20}}>当前分区没有额外快捷操作。</Text>
          )}
        </View>
      </Card>

      <Card title="当前配置摘要">
        {Object.entries(toJsonRecord(config.data)).map(([key, value]) => (
          <KeyValueRow key={key} label={key} value={typeof value === 'object' ? JSON.stringify(value) : String(value)} />
        ))}
      </Card>
    </Screen>
  );
}
