import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {AppLocale, AuthStatus, ServerConfig, ThemeMode} from '../types';
import {DbOnlineApi} from '../services/api/client';
import {createApiFacade} from '../services/api/endpoints';
import {
  clearServerConfig as clearStoredServerConfig,
  clearToken as clearStoredToken,
  loadLocale,
  loadServerConfig,
  loadThemeMode,
  loadToken,
  saveLocale as persistLocale,
  saveServerConfig as persistServerConfig,
  saveThemeMode as persistThemeMode,
  saveToken as persistToken,
} from '../services/storage';
import {normalizeServerConfig} from '../utils/url';
import {translate} from '../i18n';

type AppStateValue = {
  booting: boolean;
  serverConfig: ServerConfig | null;
  token: string | null;
  authStatus: AuthStatus | null;
  themeMode: ThemeMode;
  locale: AppLocale;
  api: ReturnType<typeof createApiFacade>;
  setServerUrl: (rawUrl: string) => Promise<void>;
  clearServer: () => Promise<void>;
  setSessionToken: (token: string | null) => Promise<void>;
  setAuthStatus: (status: AuthStatus | null) => void;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLocale: (locale: AppLocale) => Promise<void>;
  t: (key: string) => string;
};

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppProvider({children}: PropsWithChildren) {
  const [booting, setBooting] = useState(true);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [locale, setLocaleState] = useState<AppLocale>('zh-CN');

  useEffect(() => {
    let alive = true;
    Promise.all([loadServerConfig(), loadToken(), loadThemeMode(), loadLocale()])
      .then(([storedServer, storedToken, storedTheme, storedLocale]) => {
        if (!alive) {
          return;
        }
        setServerConfig(storedServer);
        setToken(storedToken);
        setThemeModeState(storedTheme);
        setLocaleState(storedLocale);
      })
      .finally(() => {
        if (alive) {
          setBooting(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const rawApi = useMemo(
    () =>
      new DbOnlineApi(
        () => serverConfig,
        () => token,
      ),
    [serverConfig, token],
  );

  const api = useMemo(() => createApiFacade(rawApi), [rawApi]);

  const setServerUrl = useCallback(async (rawUrl: string) => {
    const config = normalizeServerConfig(rawUrl);
    setServerConfig(config);
    await persistServerConfig(config);
  }, []);

  const clearServer = useCallback(async () => {
    await Promise.all([clearStoredServerConfig(), clearStoredToken()]);
    setServerConfig(null);
    setToken(null);
    setAuthStatus(null);
  }, []);

  const setSessionToken = useCallback(async (nextToken: string | null) => {
    if (nextToken) {
      await persistToken(nextToken);
    } else {
      await clearStoredToken();
    }
    setToken(nextToken);
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await persistThemeMode(mode);
  }, []);

  const setLocale = useCallback(async (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    await persistLocale(nextLocale);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      booting,
      serverConfig,
      token,
      authStatus,
      themeMode,
      locale,
      api,
      setServerUrl,
      clearServer,
      setSessionToken,
      setAuthStatus,
      setThemeMode,
      setLocale,
      t: key => translate(locale, key),
    }),
    [
      api,
      authStatus,
      booting,
      clearServer,
      locale,
      serverConfig,
      setLocale,
      setServerUrl,
      setSessionToken,
      setThemeMode,
      themeMode,
      token,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export const useAppState = () => {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState must be used inside AppProvider');
  }
  return value;
};
