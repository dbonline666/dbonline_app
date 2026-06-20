import React, {useMemo, useState} from 'react';
import {View} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {Field, ErrorState, LoadingState, Screen, SegmentedControl} from '../components/ui';
import {VideoList} from '../components/VideoList';
import {useAppState} from '../state/AppState';
import type {RootStackParamList} from '../navigation/types';
import {extractList} from '../services/api/endpoints';
import {normalizeVideo} from '../utils/data';
import {spacing} from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type SortMode = 'updated' | 'release' | 'score';

export function LibraryScreen() {
  const navigation = useNavigation<Navigation>();
  const {api, serverConfig} = useAppState();
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<SortMode>('updated');
  const params = useMemo(() => {
    const sortKey = sort === 'updated' ? 'updated' : sort;
    return {
      page: 1,
      pageSize: 50,
      sort: sortKey,
      order: 'desc',
      filters: filter ? {filter} : {},
    };
  }, [filter, sort]);
  const videos = useQuery({
    queryKey: ['videos', params],
    queryFn: () => api.getAllVideos(params.page, params.pageSize, params.sort, params.order, params.filters),
  });

  if (videos.isLoading) {
    return <LoadingState />;
  }

  if (videos.error) {
    return <ErrorState message={(videos.error as Error).message} onRetry={() => videos.refetch()} />;
  }

  const items = extractList(videos.data).map(item => normalizeVideo(item, serverConfig));

  return (
    <Screen scroll={false} padded={false}>
      <View style={{padding: spacing.lg, gap: spacing.md}}>
        <Field label="筛选" value={filter} onChangeText={setFilter} placeholder="番号、演员、类别条件" />
        <SegmentedControl
          value={sort}
          onChange={setSort}
          options={[
            {label: '更新', value: 'updated'},
            {label: '发行', value: 'release'},
            {label: '评分', value: 'score'},
          ]}
        />
      </View>
      <VideoList
        items={items}
        refreshing={videos.isFetching}
        onRefresh={() => videos.refetch()}
        onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
      />
    </Screen>
  );
}
