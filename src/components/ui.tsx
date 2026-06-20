import React, {PropsWithChildren, ReactNode} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {appColors, radius, spacing} from '../theme';

export const useAppColors = () => {
  const theme = useTheme();
  return appColors(theme.dark ? 'dark' : 'light');
};

export function Screen({
  children,
  scroll = true,
  padded = true,
}: PropsWithChildren<{scroll?: boolean; padded?: boolean}>) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.screenContent,
    padded ? styles.padded : null,
    {paddingBottom: Math.max(insets.bottom, spacing.lg), backgroundColor: colors.background},
  ];

  if (!scroll) {
    return <View style={[styles.screen, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView style={[styles.screen, {backgroundColor: colors.background}]} contentContainerStyle={contentStyle}>
      {children}
    </ScrollView>
  );
}

export function Card({children, title, action}: PropsWithChildren<{title?: string; action?: ReactNode}>) {
  const colors = useAppColors();
  return (
    <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
      {(title || action) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={[styles.cardTitle, {color: colors.text}]}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'neutral';
}) {
  const colors = useAppColors();
  const backgroundColor =
    tone === 'danger' ? colors.danger : tone === 'neutral' ? colors.border : colors.primary;
  const textColor = tone === 'neutral' ? colors.text : '#ffffff';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        {backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.78 : 1},
      ]}>
      <Text style={[styles.buttonText, {color: textColor}]}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({label, onPress}: {label: string; onPress: () => void}) {
  const colors = useAppColors();
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.textButton, {color: colors.primary}]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
} & Pick<TextInputProps, 'secureTextEntry' | 'keyboardType' | 'multiline'>) {
  const colors = useAppColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, {color: colors.mutedText}]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
          {borderColor: colors.border, color: colors.text, backgroundColor: colors.elevated},
        ]}
      />
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: {label: string; value: T}[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.segmented, {backgroundColor: colors.border}]}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? {backgroundColor: colors.surface} : null]}>
            <Text style={[styles.segmentText, {color: active ? colors.text : colors.mutedText}]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function KeyValueRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: ReactNode;
  onPress?: () => void;
}) {
  const colors = useAppColors();
  const content = (
    <View style={[styles.row, {borderBottomColor: colors.border}]}>
      <Text style={[styles.rowLabel, {color: colors.text}]}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={[styles.rowValue, {color: colors.mutedText}]} numberOfLines={2}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function LoadingState({label = '加载中'}: {label?: string}) {
  const colors = useAppColors();
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.stateText, {color: colors.mutedText}]}>{label}</Text>
    </View>
  );
}

export function EmptyState({label = '暂无数据'}: {label?: string}) {
  const colors = useAppColors();
  return (
    <View style={styles.stateBox}>
      <Text style={[styles.stateText, {color: colors.mutedText}]}>{label}</Text>
    </View>
  );
}

export function ErrorState({message, onRetry}: {message: string; onRetry?: () => void}) {
  const colors = useAppColors();
  return (
    <Card>
      <Text style={[styles.errorText, {color: colors.danger}]}>{message}</Text>
      {onRetry ? <PrimaryButton label="重试" onPress={onRetry} tone="neutral" /> : null}
    </Card>
  );
}

export function VideoThumb({uri}: {uri?: string}) {
  const colors = useAppColors();
  if (!uri) {
    return (
      <View style={[styles.thumb, {backgroundColor: colors.border}]}>
        <Text style={{color: colors.mutedText}}>NO IMG</Text>
      </View>
    );
  }

  return <Image source={{uri}} style={styles.thumb} resizeMode="cover" />;
}

export function Badge({label, tone = 'neutral'}: {label: string; tone?: 'neutral' | 'success' | 'warning'}) {
  const colors = useAppColors();
  const backgroundColor =
    tone === 'success'
      ? 'rgba(22, 163, 74, 0.14)'
      : tone === 'warning'
        ? 'rgba(217, 119, 6, 0.16)'
        : colors.border;
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.text;
  return (
    <View style={[styles.badge, {backgroundColor}]}>
      <Text style={[styles.badgeText, {color}]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({children}: PropsWithChildren) {
  const colors = useAppColors();
  return <Text style={[styles.sectionTitle, {color: colors.mutedText}]}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    gap: spacing.md,
  },
  padded: {
    padding: spacing.lg,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  textButton: {
    fontSize: 15,
    fontWeight: '600',
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  segmented: {
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    gap: spacing.md,
  },
  stateText: {
    fontSize: 15,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
  },
  thumb: {
    alignItems: 'center',
    aspectRatio: 0.72,
    borderRadius: radius.sm,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
});

