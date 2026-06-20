import React, {useState} from 'react';
import {Alert, Text, View} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {Card, ErrorState, Field, KeyValueRow, LoadingState, PrimaryButton, Screen, SectionTitle, useAppColors} from '../components/ui';
import {useAppState} from '../state/AppState';
import {useSchedulerSocket} from '../services/schedulerSocket';
import type {RootStackParamList} from '../navigation/types';
import {extractList} from '../services/api/endpoints';
import {normalizeVideo} from '../utils/data';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const {api, serverConfig, token} = useAppState();
  const colors = useAppColors();
  const [queuedTaskId, setQueuedTaskId] = useState('');
  const health = useQuery({queryKey: ['health'], queryFn: api.getHealth});
  const ready = useQuery({queryKey: ['ready'], queryFn: api.getReady});
  const metrics = useQuery({queryKey: ['metrics'], queryFn: api.getMetrics, enabled: !!token});
  const stats = useQuery({queryKey: ['stats'], queryFn: api.getStats, enabled: !!token});
  const recommend = useQuery({
    queryKey: ['recommend'],
    queryFn: () => api.getRecommendMovies(1, 8),
    enabled: !!token,
  });
  const scheduler = useSchedulerSocket(serverConfig, !!token);

  if (health.isLoading) {
    return <LoadingState />;
  }

  if (health.error) {
    return <ErrorState message={(health.error as Error).message} onRetry={() => health.refetch()} />;
  }

  const recommended = extractList(recommend.data).map(item => normalizeVideo(item, serverConfig));

  const cancelScheduler = async () => {
    try {
      await api.cancelScheduler();
      Alert.alert('调度器', '已提交取消当前任务请求');
    } catch (error) {
      Alert.alert('取消失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  const cancelQueuedTask = async () => {
    const taskId = queuedTaskId.trim();
    if (!taskId) {
      Alert.alert('调度器', '请输入队列任务 ID');
      return;
    }
    try {
      await api.cancelQueuedTask(taskId);
      setQueuedTaskId('');
      Alert.alert('调度器', '已提交取消队列任务请求');
    } catch (error) {
      Alert.alert('取消失败', error instanceof Error ? error.message : '请求失败');
    }
  };

  return (
    <Screen>
      <Card title="服务状态">
        <KeyValueRow label="后端" value={serverConfig?.origin} />
        <KeyValueRow label="健康" value={JSON.stringify(health.data || {})} />
        <KeyValueRow label="就绪" value={ready.data ? JSON.stringify(ready.data) : '检查中'} />
        <KeyValueRow label="调度器" value={scheduler.connected ? '已连接' : '未连接'} />
        {scheduler.status ? <KeyValueRow label="进度" value={JSON.stringify(scheduler.status)} /> : null}
      </Card>

      <Card title="调度器控制">
        <PrimaryButton label="取消当前任务" onPress={cancelScheduler} tone="neutral" />
        <Field label="队列任务 ID" value={queuedTaskId} onChangeText={setQueuedTaskId} placeholder="taskId" />
        <PrimaryButton label="取消队列任务" onPress={cancelQueuedTask} tone="danger" />
      </Card>

      <Card title="快捷入口">
        <View style={{gap: 10}}>
          <PrimaryButton label="最新影片" onPress={() => navigation.navigate('Latest')} />
          <PrimaryButton label="数据库初始化" onPress={() => navigation.navigate('Setup')} tone="neutral" />
          <PrimaryButton
            label="演员/类别筛选"
            onPress={() => navigation.navigate('Filter', {type: 'actor', value: ''})}
            tone="neutral"
          />
          <PrimaryButton label="排行榜" onPress={() => navigation.navigate('Rankings')} tone="neutral" />
          <PrimaryButton label="演员搜索" onPress={() => navigation.navigate('ActorSearch')} tone="neutral" />
          <PrimaryButton label="已观看" onPress={() => navigation.navigate('Watched')} tone="neutral" />
          <PrimaryButton label="关注" onPress={() => navigation.navigate('Following')} tone="neutral" />
          <PrimaryButton label="下载任务" onPress={() => navigation.navigate('DownloadTasks')} tone="neutral" />
          <PrimaryButton label="下载记录" onPress={() => navigation.navigate('DownloadRecords')} tone="neutral" />
        </View>
      </Card>

      <Card title="统计">
        {stats.isLoading ? (
          <LoadingState />
        ) : stats.error ? (
          <Text style={{color: colors.mutedText}}>统计暂不可用</Text>
        ) : (
          <Text style={{color: colors.text, lineHeight: 22}}>{JSON.stringify(stats.data, null, 2)}</Text>
        )}
        {metrics.data ? (
          <Text style={{color: colors.mutedText, lineHeight: 22}}>{JSON.stringify(metrics.data, null, 2)}</Text>
        ) : null}
      </Card>

      <SectionTitle>推荐</SectionTitle>
      {recommended.length ? (
        recommended.map(item => (
          <Card
            key={item.id || item.code}
            title={item.title || item.code}
            action={
              item.code ? (
                <PrimaryButton
                  label="查看"
                  onPress={() => navigation.navigate('VideoDetail', {code: item.code || ''})}
                  tone="neutral"
                />
              ) : null
            }>
            <Text style={{color: colors.mutedText}}>{[item.code, item.release_date].filter(Boolean).join(' · ')}</Text>
          </Card>
        ))
      ) : (
        <Card>
          <Text style={{color: colors.mutedText}}>暂无推荐内容</Text>
        </Card>
      )}
    </Screen>
  );
}
