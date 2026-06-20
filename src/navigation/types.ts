import type {NavigatorScreenParams} from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Library: undefined;
  Search: undefined;
  Subscriptions: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  ServerSetup: undefined;
  Login: undefined;
  AccessRestricted: {from?: string} | undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Setup: undefined;
  VideoDetail: {code: string; videoId?: string};
  Player: {code: string; title?: string; streamUrl?: string};
  Rankings: undefined;
  Latest: undefined;
  ActorSearch: undefined;
  Filter: {
    type: 'actor' | 'category';
    id?: string;
    value?: string;
    name?: string;
  };
  EntityMovies: {
    entity: 'actor' | 'series' | 'makers' | 'publishers' | 'directors' | 'lists';
    id: string;
    title?: string;
  };
  Watched: undefined;
  Following: undefined;
  DownloadTasks: undefined;
  DownloadRecords: undefined;
  SettingsSection: {section: string; title: string};
};
