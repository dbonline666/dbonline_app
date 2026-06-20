import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer, Theme, useTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  Clapperboard,
  Home,
  Search,
  Settings,
  Star,
} from 'lucide-react-native';
import {useQuery} from '@tanstack/react-query';
import type {MainTabParamList, RootStackParamList} from './types';
import {useAppState} from '../state/AppState';
import {appColors} from '../theme';
import {HomeScreen} from '../screens/HomeScreen';
import {ServerSetupScreen} from '../screens/ServerSetupScreen';
import {LoginScreen} from '../screens/LoginScreen';
import {AccessRestrictedScreen} from '../screens/AccessRestrictedScreen';
import {LibraryScreen} from '../screens/LibraryScreen';
import {SearchScreen} from '../screens/SearchScreen';
import {SettingsScreen, SettingsSectionScreen} from '../screens/SettingsScreen';
import {VideoDetailScreen} from '../screens/VideoDetailScreen';
import {PlayerScreen} from '../screens/PlayerScreen';
import {
  ActorSearchScreen,
  DownloadRecordsScreen,
  DownloadTasksScreen,
  EntityMoviesScreen,
  FilterScreen,
  FollowingScreen,
  LatestScreen,
  RankingsScreen,
  SubscriptionsScreen,
  WatchedScreen,
} from '../screens/FeatureScreens';
import {SetupScreen} from '../screens/SetupScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const {t} = useAppState();
  const theme = useTheme();
  const colors = appColors(theme.dark ? 'dark' : 'light');
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarLabelStyle: {fontWeight: '800', fontSize: 11},
        tabBarStyle: {
          backgroundColor: colors.panelStrong,
          borderTopColor: colors.panelBorder,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 7,
          paddingTop: 7,
        },
      }}>
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('home'),
          tabBarIcon: ({color, size}) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: t('library'),
          tabBarIcon: ({color, size}) => <Clapperboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: t('search'),
          tabBarIcon: ({color, size}) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{
          title: t('subscriptions'),
          tabBarIcon: ({color, size}) => <Star color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings'),
          tabBarIcon: ({color, size}) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

function Gate() {
  const {api, booting, serverConfig, token, setAuthStatus, setSessionToken} = useAppState();
  const theme = useTheme();
  const colors = appColors(theme.dark ? 'dark' : 'light');
  const authStatusQuery = useQuery({
    queryKey: ['auth-status', serverConfig?.origin],
    enabled: !!serverConfig && !booting,
    queryFn: api.authStatus,
  });
  const status = authStatusQuery.data;
  const verifyQuery = useQuery({
    queryKey: ['auth-verify', serverConfig?.origin, token],
    enabled: !!serverConfig && !!token && !!status?.enabled && status.configured,
    queryFn: api.authVerify,
  });

  React.useEffect(() => {
    if (authStatusQuery.data) {
      setAuthStatus(authStatusQuery.data);
    }
  }, [authStatusQuery.data, setAuthStatus]);

  React.useEffect(() => {
    if (verifyQuery.data && !verifyQuery.data.valid) {
      void setSessionToken(null);
    }
    if (verifyQuery.error) {
      void setSessionToken(null);
    }
  }, [setSessionToken, verifyQuery.data, verifyQuery.error]);

  if (booting) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!serverConfig) {
    return <ServerSetupScreen />;
  }

  if (authStatusQuery.error && (authStatusQuery.error as {accessRestriction?: string}).accessRestriction === 'local-only') {
    return <AccessRestrictedScreen />;
  }

  if (status?.enabled && status.configured && token && verifyQuery.isLoading) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (status?.enabled && status.configured && !token) {
    return <LoginScreen />;
  }

  return <MainTabs />;
}

export function AppNavigator({theme}: {theme: Theme}) {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {backgroundColor: theme.colors.card},
          headerTintColor: theme.colors.text,
          headerTitleStyle: {fontWeight: '800'},
          headerShadowVisible: false,
          contentStyle: {backgroundColor: theme.colors.background},
        }}>
        <Stack.Screen
          name="MainTabs"
          component={Gate}
          options={{headerShown: false}}
        />
        <Stack.Screen name="Setup" component={SetupScreen} options={{title: '初始化'}} />
        <Stack.Screen name="VideoDetail" component={VideoDetailScreen} options={{title: '影片详情'}} />
        <Stack.Screen name="Player" component={PlayerScreen} options={{title: '播放'}} />
        <Stack.Screen name="Rankings" component={RankingsScreen} options={{title: '排行榜'}} />
        <Stack.Screen name="Latest" component={LatestScreen} options={{title: '最新'}} />
        <Stack.Screen name="ActorSearch" component={ActorSearchScreen} options={{title: '演员搜索'}} />
        <Stack.Screen name="Filter" component={FilterScreen} options={{title: '筛选'}} />
        <Stack.Screen name="EntityMovies" component={EntityMoviesScreen} options={{title: '影片列表'}} />
        <Stack.Screen name="Watched" component={WatchedScreen} options={{title: '已观看'}} />
        <Stack.Screen name="Following" component={FollowingScreen} options={{title: '关注'}} />
        <Stack.Screen name="DownloadTasks" component={DownloadTasksScreen} options={{title: '下载任务'}} />
        <Stack.Screen name="DownloadRecords" component={DownloadRecordsScreen} options={{title: '下载记录'}} />
        <Stack.Screen name="SettingsSection" component={SettingsSectionScreen} options={({route}) => ({title: route.params.title})} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
