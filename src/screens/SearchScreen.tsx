import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {launchImageLibrary} from 'react-native-image-picker';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {Card, EmptyState, Field, ErrorState, LoadingState, PrimaryButton, Screen, SegmentedControl, useAppColors} from '../components/ui';
import {VideoList} from '../components/VideoList';
import {useAppState} from '../state/AppState';
import type {RootStackParamList} from '../navigation/types';
import {extractList} from '../services/api/endpoints';
import {normalizeVideo, pickString, summarizeRecord} from '../utils/data';
import {spacing} from '../theme';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type SearchMode = 'movie' | 'actor' | 'series' | 'maker' | 'publisher' | 'director' | 'list';
type EntityMode = Exclude<SearchMode, 'movie'>;

const entityRoute: Record<EntityMode, RootStackParamList['EntityMovies']['entity']> = {
  actor: 'actor',
  series: 'series',
  maker: 'makers',
  publisher: 'publishers',
  director: 'directors',
  list: 'lists',
};

export function SearchScreen() {
  const navigation = useNavigation<Navigation>();
  const {api, serverConfig} = useAppState();
  const colors = useAppColors();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('movie');
  const enabled = query.trim().length > 0;
  const result = useQuery({
    queryKey: ['search', mode, query],
    enabled,
    queryFn: () =>
      mode === 'actor'
        ? api.searchActors(query.trim())
        : api.search({q: query.trim(), page: 1, limit: 40, type: mode, searchType: mode}),
  });

  const imageSearch = async () => {
    const picked = await launchImageLibrary({mediaType: 'photo', selectionLimit: 1});
    const asset = picked.assets?.[0];
    if (!asset?.uri) {
      return;
    }
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'actor.jpg',
      type: asset.type || 'image/jpeg',
    } as unknown as Blob);
    try {
      const response = await api.searchActorsByImage(formData);
      Alert.alert('图片搜索结果', JSON.stringify(response).slice(0, 900));
    } catch (error) {
      Alert.alert('图片搜索失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const subscribeEntity = async (entityMode: EntityMode, id: string, name: string) => {
    try {
      if (entityMode === 'actor') {
        await api.createActorSubscription({actor_id: id, actor_name: name, name});
      } else {
        await api.createSeriesSubscription({
          external_id: id,
          sub_type: entityMode,
          series_name: name,
          name,
        });
      }
      Alert.alert('订阅', '订阅已创建');
    } catch (error) {
      Alert.alert('订阅失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const rawItems = extractList(result.data);
  const items = rawItems.map(item => normalizeVideo(item, serverConfig));

  return (
    <Screen scroll={mode !== 'movie'} padded={false}>
      <View style={{padding: spacing.lg, gap: spacing.md}}>
        <SegmentedControl<SearchMode>
          value={mode}
          onChange={setMode}
          options={[
            {label: '影片', value: 'movie'},
            {label: '演员', value: 'actor'},
            {label: '系列', value: 'series'},
          ]}
        />
        <SegmentedControl<SearchMode>
          value={mode}
          onChange={setMode}
          options={[
            {label: '制作', value: 'maker'},
            {label: '发行', value: 'publisher'},
            {label: '导演', value: 'director'},
            {label: '片单', value: 'list'},
          ]}
        />
        <Field label="关键词" value={query} onChangeText={setQuery} placeholder="输入番号、标题或演员" />
        <PrimaryButton label="图片搜索演员" onPress={imageSearch} tone="neutral" />
      </View>
      {result.isLoading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState message={(result.error as Error).message} onRetry={() => result.refetch()} />
      ) : mode !== 'movie' ? (
        <View style={{padding: spacing.lg, gap: spacing.md}}>
          {!enabled ? <EmptyState label="请输入实体关键词" /> : null}
          {enabled && !rawItems.length ? <EmptyState /> : null}
          {rawItems.map((item, index) => {
            const record = item as Record<string, unknown>;
            const id = pickString(record, ['id', 'external_id', 'actor_id']);
            const name = pickString(record, ['name', 'title', 'display_name']) || id || `实体 ${index + 1}`;
            return (
              <Card key={id || index} title={name}>
                <Text style={{color: colors.mutedText, lineHeight: 22}}>{summarizeRecord(item)}</Text>
                {id ? (
                  <View style={{gap: spacing.sm}}>
                    <PrimaryButton
                      label="查看作品"
                      onPress={() => navigation.navigate('EntityMovies', {entity: entityRoute[mode], id, title: name})}
                      tone="neutral"
                    />
                    <PrimaryButton
                      label="订阅实体"
                      onPress={() => subscribeEntity(mode, id, name)}
                      tone="neutral"
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : (
        <VideoList
          items={items}
          refreshing={result.isFetching}
          onRefresh={() => result.refetch()}
          onPress={item => navigation.navigate('VideoDetail', {code: item.code || item.id || ''})}
        />
      )}
    </Screen>
  );
}
