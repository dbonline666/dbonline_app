import type {AppLocale} from './types';

type NestedDictionary = {
  [key: string]: string | NestedDictionary;
};
type MobileDictionary = Record<string, string>;
type LocaleModule = {default: NestedDictionary};

declare const require: (path: string) => LocaleModule;

const zhCN = require('./i18n/locales/zh-CN').default as NestedDictionary;
const zhTW = require('./i18n/locales/zh-TW').default as NestedDictionary;
const enUS = require('./i18n/locales/en-US').default as NestedDictionary;
const jaJP = require('./i18n/locales/ja-JP').default as NestedDictionary;

const mobileZhCN: MobileDictionary = {
  appName: 'DB Online',
  serverTitle: '连接服务器',
  serverSubtitle: '输入已部署的 DB Online 服务地址',
  serverUrl: '服务器地址',
  connect: '连接',
  login: '登录',
  password: '密码',
  totp: '双因素验证码',
  loginWithPassword: '密码登录',
  passkeyUnavailable: 'Passkey 暂不可用，请使用密码或 TOTP 登录。',
  home: '首页',
  library: '媒体库',
  search: '搜索',
  subscriptions: '订阅',
  settings: '设置',
  latest: '最新',
  rankings: '排行榜',
  actors: '演员',
  downloads: '下载',
  records: '记录',
  following: '关注',
  watched: '已观看',
  retry: '重试',
  empty: '暂无数据',
  loading: '加载中',
  save: '保存',
  logout: '退出登录',
  clearServer: '重置服务器',
};

const mobileEnUS: MobileDictionary = {
  appName: 'DB Online',
  serverTitle: 'Connect server',
  serverSubtitle: 'Enter your DB Online server address',
  serverUrl: 'Server URL',
  connect: 'Connect',
  login: 'Sign in',
  password: 'Password',
  totp: 'TOTP code',
  loginWithPassword: 'Sign in',
  passkeyUnavailable: 'Passkey is not available yet. Use password or TOTP.',
  home: 'Home',
  library: 'Library',
  search: 'Search',
  subscriptions: 'Subscriptions',
  settings: 'Settings',
  latest: 'Latest',
  rankings: 'Rankings',
  actors: 'Actors',
  downloads: 'Downloads',
  records: 'Records',
  following: 'Following',
  watched: 'Watched',
  retry: 'Retry',
  empty: 'No data',
  loading: 'Loading',
  save: 'Save',
  logout: 'Sign out',
  clearServer: 'Reset server',
};

const frontendDictionaries: Record<AppLocale, NestedDictionary> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
  'ja-JP': jaJP,
};

const mobileDictionaries: Record<AppLocale, MobileDictionary> = {
  'zh-CN': mobileZhCN,
  'zh-TW': mobileZhCN,
  'en-US': mobileEnUS,
  'ja-JP': mobileEnUS,
};

const aliases: Record<string, string> = {
  appName: 'common.appName',
  home: 'nav.home',
  library: 'nav.videos',
  search: 'common.search',
  subscriptions: 'nav.subscriptions',
  settings: 'nav.settings',
  latest: 'nav.latest',
  rankings: 'nav.rankings',
  actors: 'common.actors',
  following: 'nav.following',
  watched: 'nav.watched',
  retry: 'common.retry',
  empty: 'common.empty',
  loading: 'common.loading',
  save: 'common.save',
  logout: 'auth.logout',
};

const readNested = (dictionary: NestedDictionary, key: string) => {
  let cursor: string | NestedDictionary | undefined = dictionary;
  for (const part of key.split('.')) {
    if (!cursor || typeof cursor === 'string') {
      return '';
    }
    cursor = cursor[part];
  }
  return typeof cursor === 'string' ? cursor : '';
};

export const translate = (locale: AppLocale, key: string) => {
  const mobile = mobileDictionaries[locale]?.[key] || mobileDictionaries['zh-CN'][key];
  if (mobile) {
    return mobile;
  }

  const dictionary = frontendDictionaries[locale] || frontendDictionaries['zh-CN'];
  const direct = readNested(dictionary, key);
  if (direct) {
    return direct;
  }

  const alias = aliases[key] ? readNested(dictionary, aliases[key]) : '';
  return alias || key;
};
