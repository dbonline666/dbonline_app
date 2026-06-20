import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import type {AppLocale, ServerConfig, ThemeMode} from '../types';

const SERVER_CONFIG_KEY = 'db_online_mobile_server_config';
const THEME_KEY = 'db_online_mobile_theme';
const LOCALE_KEY = 'db_online_mobile_locale';
const TOKEN_SERVICE = 'db_online_mobile_token';

export const loadServerConfig = async (): Promise<ServerConfig | null> => {
  const value = await AsyncStorage.getItem(SERVER_CONFIG_KEY);
  return value ? (JSON.parse(value) as ServerConfig) : null;
};

export const saveServerConfig = (config: ServerConfig) =>
  AsyncStorage.setItem(SERVER_CONFIG_KEY, JSON.stringify(config));

export const clearServerConfig = () => AsyncStorage.removeItem(SERVER_CONFIG_KEY);

export const loadThemeMode = async (): Promise<ThemeMode> => {
  const value = await AsyncStorage.getItem(THEME_KEY);
  return value === 'light' || value === 'dark' || value === 'system'
    ? value
    : 'dark';
};

export const saveThemeMode = (mode: ThemeMode) => AsyncStorage.setItem(THEME_KEY, mode);

export const loadLocale = async (): Promise<AppLocale> => {
  const value = await AsyncStorage.getItem(LOCALE_KEY);
  if (
    value === 'zh-CN' ||
    value === 'zh-TW' ||
    value === 'en-US' ||
    value === 'ja-JP'
  ) {
    return value;
  }
  return 'zh-CN';
};

export const saveLocale = (locale: AppLocale) => AsyncStorage.setItem(LOCALE_KEY, locale);

export const loadToken = async () => {
  const credentials = await Keychain.getGenericPassword({service: TOKEN_SERVICE});
  return credentials ? credentials.password : null;
};

export const saveToken = (token: string) =>
  Keychain.setGenericPassword('db-online', token, {service: TOKEN_SERVICE});

export const clearToken = () => Keychain.resetGenericPassword({service: TOKEN_SERVICE});
