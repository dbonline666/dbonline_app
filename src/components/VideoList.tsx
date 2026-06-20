import React from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import type {VideoSummary} from '../types';
import {Badge, EmptyState, useAppColors} from './ui';
import {radius, spacing} from '../theme';

const extractTextList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (typeof item === 'string') {
        return item;
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return String(record.name || record.title || record.label || '').trim();
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, 3);
};

const pickNumber = (item: VideoSummary, keys: string[]) => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
};

const hasFlag = (item: VideoSummary, keys: string[]) =>
  keys.some(key => item[key] === true || item[key] === 1 || item[key] === 'true');

function VideoCardItem({
  item,
  onPress,
}: {
  item: VideoSummary;
  onPress: (item: VideoSummary) => void;
}) {
  const colors = useAppColors();
  const cover = typeof item.cover === 'string' ? item.cover : typeof item.cover_url === 'string' ? item.cover_url : '';
  const date = item.release_date || item.date || '';
  const code = item.code || item.id || '';
  const magnetCount = pickNumber(item, ['magnet_count', 'magnets_count', 'total_magnets']);
  const duration = pickNumber(item, ['duration', 'runtime']);
  const tags = extractTextList(item.categories).length ? extractTextList(item.categories) : extractTextList(item.actors);
  const hasSubtitle = hasFlag(item, ['has_subtitle', 'has_cnsub', 'has_magnet_subtitle']);
  const inLibrary =
    item.library && typeof item.library === 'object'
      ? Boolean((item.library as Record<string, unknown>).in_library)
      : hasFlag(item, ['in_library']);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({pressed}) => [
        styles.card,
        {
          backgroundColor: colors.panel,
          borderColor: colors.panelBorder,
          opacity: pressed ? 0.78 : 1,
          shadowColor: colors.shadow,
        },
      ]}>
      <View style={[styles.coverWrap, {backgroundColor: colors.inputBg}]}>
        {cover ? (
          <Image source={{uri: cover}} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={[styles.coverFallbackText, {color: colors.mutedText}]}>NO IMG</Text>
          </View>
        )}
        <View style={styles.coverShade} />
        {code ? (
          <View style={[styles.codeBadge, {backgroundColor: colors.secondarySoft, borderColor: colors.secondary}]}>
            <Text style={[styles.codeText, {color: colors.code}]} numberOfLines={1}>
              {code}
            </Text>
          </View>
        ) : null}
        {inLibrary ? (
          <View style={[styles.libraryBadge, {backgroundColor: colors.successSoft, borderColor: colors.success}]}>
            <Text style={[styles.overlayBadgeText, {color: colors.success}]}>入库</Text>
          </View>
        ) : null}
        <View style={styles.coverBadges}>
          {hasSubtitle ? <MiniBadge label="字幕" tone="primary" /> : null}
          {magnetCount > 0 ? <MiniBadge label={`磁链 ${magnetCount}`} tone="warning" /> : null}
          {duration > 0 ? <MiniBadge label={`${duration}m`} tone="neutral" /> : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, {color: colors.text}]} numberOfLines={2}>
          {item.title || code || 'Untitled'}
        </Text>
        <Text style={[styles.meta, {color: colors.mutedText}]} numberOfLines={1}>
          {date || '----'}
        </Text>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map(tag => (
              <Text key={tag} style={[styles.tag, {color: colors.secondaryText, backgroundColor: colors.chipBg}]} numberOfLines={1}>
                {tag}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.badges}>
          {typeof item.score === 'number' ? <Badge label={`评分 ${item.score}`} tone="secondary" /> : null}
          {typeof item.user_score === 'number' ? <Badge label={`我的 ${item.user_score}`} tone="success" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function MiniBadge({label, tone}: {label: string; tone: 'primary' | 'warning' | 'neutral'}) {
  const colors = useAppColors();
  const color = tone === 'primary' ? colors.primary : tone === 'warning' ? colors.warning : colors.secondaryText;
  const backgroundColor = tone === 'primary' ? colors.primarySoft : tone === 'warning' ? colors.warningSoft : colors.chipBg;
  return (
    <View style={[styles.miniBadge, {backgroundColor, borderColor: color}]}>
      <Text style={[styles.overlayBadgeText, {color}]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function VideoGrid({
  items,
  onPress,
}: {
  items: VideoSummary[];
  onPress: (item: VideoSummary) => void;
}) {
  if (!items.length) {
    return <EmptyState />;
  }

  return (
    <View style={styles.embeddedGrid}>
      {items.map((item, index) => (
        <View key={item.id || item.code || String(index)} style={styles.embeddedCell}>
          <VideoCardItem item={item} onPress={onPress} />
        </View>
      ))}
    </View>
  );
}

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
  return (
    <FlatList
      data={items}
      numColumns={3}
      keyExtractor={(item, index) => item.id || item.code || String(index)}
      contentContainerStyle={items.length ? styles.list : styles.emptyList}
      columnWrapperStyle={items.length ? styles.row : undefined}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={<EmptyState />}
      renderItem={({item}) => (
        <View style={styles.cell}>
          <VideoCardItem item={item} onPress={onPress} />
        </View>
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
  row: {
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    maxWidth: '32.2%',
    minWidth: 0,
  },
  embeddedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  embeddedCell: {
    flexBasis: '31.8%',
    flexGrow: 1,
    maxWidth: '32.2%',
    minWidth: 0,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    minHeight: 238,
    overflow: 'hidden',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.48,
    shadowRadius: 18,
  },
  coverWrap: {
    aspectRatio: 0.72,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  cover: {
    height: '100%',
    width: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  coverFallbackText: {
    fontSize: 10,
    fontWeight: '800',
  },
  coverShade: {
    backgroundColor: 'rgba(0, 0, 0, 0.20)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  codeBadge: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    left: 6,
    maxWidth: '68%',
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    top: 6,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  libraryBadge: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    paddingVertical: 2,
    position: 'absolute',
    right: 6,
    top: 6,
  },
  coverBadges: {
    bottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    left: 6,
    position: 'absolute',
    right: 6,
  },
  miniBadge: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  overlayBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  body: {
    gap: 5,
    padding: spacing.sm,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  meta: {
    fontSize: 10,
    lineHeight: 13,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    minHeight: 16,
  },
  tag: {
    borderRadius: radius.sm,
    fontSize: 9,
    fontWeight: '700',
    maxWidth: '100%',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
});
