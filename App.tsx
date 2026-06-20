import 'react-native-gesture-handler';
import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppProvider, useAppState} from './src/state/AppState';
import {AppNavigator} from './src/navigation/AppNavigator';
import {getNavigationTheme, palette} from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppFrame() {
  const systemScheme = useColorScheme();
  const {themeMode} = useAppState();
  const effectiveMode = themeMode === 'system' ? systemScheme || 'dark' : themeMode;
  const isDark = effectiveMode === 'dark';

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? palette.bgDeep : palette.neutral50}
      />
      <AppNavigator theme={getNavigationTheme(effectiveMode)} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <AppFrame />
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
