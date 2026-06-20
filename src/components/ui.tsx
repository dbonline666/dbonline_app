import React, {PropsWithChildren, ReactNode} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import {useTheme} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {appColors, radius, spacing} from '../theme';

export const useAppColors = () => {
  const theme = useTheme();
  return appColors(theme.dark ? 'dark' : 'light');
};

function ScreenChrome() {
  const colors = useAppColors();
  return (
    <>
      <View pointerEvents="none" style={[styles.topRule, {backgroundColor: colors.primary}]} />
      <View pointerEvents="none" style={[styles.leftRule, {backgroundColor: colors.secondary}]} />
      <View pointerEvents="none" style={[styles.screenTint, {borderColor: colors.panelBorder}]} />
    </>
  );
}

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
    {paddingBottom: Math.max(insets.bottom, spacing.lg)},
  ];

  if (!scroll) {
    return (
      <View style={[styles.screen, {backgroundColor: colors.background}]}>
        <ScreenChrome />
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <ScreenChrome />
      <ScrollView style={styles.screenScroll} contentContainerStyle={contentStyle}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({
  children,
  title,
  action,
  variant = 'default',
  style,
}: PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  variant?: 'default' | 'strong' | 'cyber';
  style?: StyleProp<ViewStyle>;
}>) {
  const colors = useAppColors();
  const isCyber = variant === 'cyber';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'strong' || isCyber ? colors.panelStrong : colors.panel,
          borderColor: isCyber ? colors.primary : colors.panelBorder,
          shadowColor: colors.shadow,
        },
        isCyber ? styles.cyberCard : null,
        style,
      ]}>
      {isCyber ? <CyberCorners /> : null}
      {(title || action) && (
        <View style={styles.cardHeader}>
          {title ? <Text style={[styles.cardTitle, {color: isCyber ? colors.primary : colors.text}]}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

function CyberCorners() {
  const colors = useAppColors();
  return (
    <>
      <View style={[styles.corner, styles.cornerTopLeft, {borderColor: colors.primary}]} />
      <View style={[styles.corner, styles.cornerTopRight, {borderColor: colors.primary}]} />
      <View style={[styles.corner, styles.cornerBottomLeft, {borderColor: colors.secondary}]} />
      <View style={[styles.corner, styles.cornerBottomRight, {borderColor: colors.secondary}]} />
    </>
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
  tone?: 'primary' | 'danger' | 'neutral' | 'secondary' | 'success' | 'warning';
}) {
  const colors = useAppColors();
  const toneColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'neutral'
        ? colors.secondaryText
        : tone === 'secondary'
          ? colors.secondary
          : tone === 'success'
            ? colors.success
            : tone === 'warning'
              ? colors.warning
              : colors.primary;
  const softBg =
    tone === 'danger'
      ? colors.accentSoft
      : tone === 'neutral'
        ? colors.chipBg
        : tone === 'secondary'
          ? colors.secondarySoft
          : tone === 'success'
            ? colors.successSoft
            : tone === 'warning'
              ? colors.warningSoft
              : colors.primarySoft;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: pressed ? softBg : 'rgba(255, 255, 255, 0.03)',
          borderColor: disabled ? colors.panelBorder : toneColor,
          opacity: disabled ? 0.5 : 1,
          shadowColor: toneColor,
        },
        pressed && !disabled ? styles.buttonPressed : null,
      ]}>
      <Text style={[styles.buttonText, {color: toneColor}]} numberOfLines={1}>
        {label}
      </Text>
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
          {
            borderColor: colors.panelBorder,
            color: colors.text,
            backgroundColor: colors.inputBg,
          },
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
    <View style={[styles.segmented, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active ? {backgroundColor: colors.primarySoft, borderColor: colors.primary} : {borderColor: 'transparent'},
            ]}>
            <Text style={[styles.segmentText, {color: active ? colors.primary : colors.mutedText}]} numberOfLines={1}>
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
    <View style={[styles.row, {borderBottomColor: colors.panelBorder}]}>
      <Text style={[styles.rowLabel, {color: colors.text}]} numberOfLines={1}>
        {label}
      </Text>
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
      <Text style={[styles.stateText, {color: colors.primary}]}>{label}</Text>
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
    <Card variant="cyber">
      <Text style={[styles.errorText, {color: colors.danger}]}>{message}</Text>
      {onRetry ? <PrimaryButton label="重试" onPress={onRetry} tone="neutral" /> : null}
    </Card>
  );
}

export function VideoThumb({uri}: {uri?: string}) {
  const colors = useAppColors();
  if (!uri) {
    return (
      <View style={[styles.thumb, {backgroundColor: colors.inputBg, borderColor: colors.panelBorder}]}>
        <Text style={{color: colors.mutedText}}>NO IMG</Text>
      </View>
    );
  }

  return <Image source={{uri}} style={[styles.thumb, {borderColor: colors.panelBorder}]} resizeMode="cover" />;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'primary' | 'secondary';
}) {
  const colors = useAppColors();
  const toneColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'accent'
            ? colors.accent
            : tone === 'secondary'
              ? colors.secondary
              : tone === 'info' || tone === 'primary'
                ? colors.primary
                : colors.secondaryText;
  const backgroundColor =
    tone === 'success'
      ? colors.successSoft
      : tone === 'warning'
        ? colors.warningSoft
        : tone === 'danger' || tone === 'accent'
          ? colors.accentSoft
          : tone === 'secondary'
            ? colors.secondarySoft
            : tone === 'info' || tone === 'primary'
              ? colors.primarySoft
              : colors.chipBg;
  return (
    <View style={[styles.badge, {backgroundColor, borderColor: toneColor}]}>
      <Text style={[styles.badgeText, {color: toneColor}]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function SectionTitle({children}: PropsWithChildren) {
  const colors = useAppColors();
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionRule, {backgroundColor: colors.primary}]} />
      <Text style={[styles.sectionTitle, {color: colors.text}]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
  },
  screenScroll: {
    flex: 1,
  },
  screenContent: {
    flexGrow: 1,
    gap: spacing.md,
  },
  padded: {
    padding: spacing.lg,
  },
  topRule: {
    height: 1,
    left: 0,
    opacity: 0.62,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  leftRule: {
    bottom: 0,
    left: 0,
    opacity: 0.24,
    position: 'absolute',
    top: 0,
    width: 1,
    zIndex: 1,
  },
  screenTint: {
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    opacity: 0.7,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 3,
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.lg,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.72,
    shadowRadius: 24,
  },
  cyberCard: {
    borderWidth: 1,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
  },
  corner: {
    height: 16,
    position: 'absolute',
    width: 16,
    zIndex: 1,
  },
  cornerTopLeft: {
    borderLeftWidth: 1,
    borderTopWidth: 1,
    left: 7,
    top: 7,
  },
  cornerTopRight: {
    borderRightWidth: 1,
    borderTopWidth: 1,
    right: 7,
    top: 7,
  },
  cornerBottomLeft: {
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    bottom: 7,
    left: 7,
  },
  cornerBottomRight: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    bottom: 7,
    right: 7,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    elevation: 2,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.38,
    shadowRadius: 10,
  },
  buttonPressed: {
    shadowOpacity: 0.6,
    transform: [{scale: 0.99}],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  textButton: {
    fontSize: 15,
    fontWeight: '700',
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  segmented: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 3,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
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
    fontSize: 15,
    fontWeight: '700',
  },
  rowValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    gap: spacing.md,
  },
  stateText: {
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
  },
  thumb: {
    alignItems: 'center',
    aspectRatio: 0.72,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 82,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionRule: {
    height: 18,
    width: 3,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
});
