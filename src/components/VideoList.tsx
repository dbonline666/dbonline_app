import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import type {VideoSummary} from '../types';
import {Badge, EmptyState, VideoThumb, useAppColors} from './ui';
import {spacing} from '../theme';

export function VideoList({
  items,
  onPress,
  refreshing,
  onRefresh,
  onEndReached,
}: {
  items: VideoSummary[];
  onPress: (item: VideoSummary) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
}) {
  const colors = useAppColors();

  return (
    <FlatList
      data={items}
      keyExtractor={(item, index) => item.id || item.code || String(index)}
      contentContainerStyle={items.length ? styles.list : styles.emptyList}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<EmptyState />}
      renderItem={({item}) => (
        <Pressable
          onPress={() => onPress(item)}
          style={({pressed}) => [
            styles.item,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}>
          <VideoThumb uri={item.cover || item.cover_url} />
          <View style={styles.itemBody}>
            <Text style={[styles.title, {color: colors.text}]} numberOfLines={2}>
              {item.title || item.code || item.id}
            </Text>
            <Text style={[styles.meta, {color: colors.mutedText}]} numberOfLines={1}>
              {[item.code, item.release_date || item.date].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.badges}>
              {typeof item.score === 'number' ? <Badge label={`评分 ${item.score}`} /> : null}
              {typeof item.user_score === 'number' ? <Badge label={`我的 ${item.user_score}`} tone="success" /> : null}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  item: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  itemBody: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

