/**
 * Shared UI primitives built on the design tokens.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { colors, font, MIN_TOUCH, radius, spacing, typographyFor, type TypographyVariant } from '@/theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = TypographyVariant;

export function Text({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  return <RNText {...rest} style={[typographyFor(variant), { color: color ?? colors.text }, style]} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['bottom'],
  contentStyle,
  ...rest
}: {
  children?: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
  contentStyle?: StyleProp<ViewStyle>;
} & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: (edges.includes('top') ? insets.top : 0) + (padded ? spacing.lg : 0),
    paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + spacing.xxxl,
    paddingHorizontal: padded ? spacing.lg : 0,
    gap: spacing.lg,
  };
  if (!scroll) return <View style={[styles.screen, pad, contentStyle]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // iOS: keep the focused input above the keyboard (Android resizes the window instead).
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = spacing.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xs }}>
      <Text variant="label" color={colors.textSecondary} accessibilityRole="header">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Text variant="caption" color={colors.accent} style={font('semibold')}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon: Icon,
  size = 'md',
  disabled,
  loading,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const bg = { primary: colors.accent, secondary: colors.surface, ghost: 'transparent', danger: 'rgba(255,92,92,0.12)' }[variant];
  const fg = { primary: colors.onAccent, secondary: colors.text, ghost: colors.accent, danger: colors.error }[variant];
  const height = { sm: 36, md: 48, lg: 56 }[size];
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          flushPendingInputs();
          onPress();
        })
      }
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: height, paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.border },
        pressed && styles.pressed,
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon color={fg} size={size === 'lg' ? 22 : 18} strokeWidth={2.4} /> : null}
          <Text variant={size === 'lg' ? 'heading' : 'bodyStrong'} color={fg} style={[font('bold'), size === 'sm' ? { fontSize: 13 } : null]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  onPress,
  label,
  color = colors.text,
  background = colors.surface,
  size = 40,
  disabled,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  color?: string;
  background?: string;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          flushPendingInputs();
          onPress();
        })
      }
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Math.max(0, (MIN_TOUCH - size) / 2)}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, alignItems: 'center', justifyContent: 'center' },
        pressed && styles.pressed,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Icon color={color} size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: colors.accent, borderColor: colors.accent },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text variant="caption" color={selected ? colors.onAccent : colors.text} style={font('semibold')}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  allowNone,
}: {
  options: { key: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} selected={value === o.key} onPress={() => onChange(allowNone && value === o.key ? null : o.key)} />
      ))}
    </ScrollView>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: colors.accent }]}
          >
            <Text variant="caption" color={active ? colors.onAccent : colors.textSecondary} style={font('bold')}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function StatTile({ label, value, sub, accent, style }: { label: string; value: string; sub?: string; accent?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]} accessible accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}>
      <Text variant="label" color={colors.textSecondary} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="title" color={accent ? colors.accent : colors.text} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function ProgressBar({ progress, color = colors.accent, height = 8 }: { progress: number | null; color?: string; height?: number }) {
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const over = (progress ?? 0) > 1;
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: colors.surface, overflow: 'hidden' }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}
    >
      <View style={{ width: `${p * 100}%`, height: '100%', backgroundColor: over ? colors.warning : color, borderRadius: height }} />
    </View>
  );
}

export function EmptyState({ icon: Icon, title, message, action, onAction }: { icon?: LucideIcon; title: string; message?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.empty}>
      {Icon ? (
        <View style={styles.emptyIcon}>
          <Icon color={colors.accent} size={26} />
        </View>
      ) : null}
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message ? (
        <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
          {message}
        </Text>
      ) : null}
      {action && onAction ? <Button title={action} onPress={onAction} size="sm" style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Text variant="caption" color={colors.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="label" color={colors.textSecondary}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        accessibilityLabel={label}
        {...props}
        style={[styles.input, font('regular'), error ? { borderColor: colors.error } : null, props.multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md }, style as StyleProp<TextStyle>]}
      />
      <ErrorText message={error} />
    </View>
  );
}

/**
 * Numeric input that keeps its own text while focused.
 * - debounceMs = 0 (default): commits on every change — for local form state.
 * - debounceMs > 0: for DB-backed values; commits after a pause in typing, on blur,
 *   on unmount, and whenever flushPendingInputs() runs (buttons call it before onPress).
 */
// Pending debounced commits from DB-backed NumberInputs. Flushed before any button press,
// on unmount and when the app is backgrounded, so the latest typed value is never lost.
const pendingCommits = new Set<() => void>();

/** Commit every NumberInput value that is still waiting for its debounce. */
export function flushPendingInputs(): void {
  for (const fn of [...pendingCommits]) fn();
}

export function NumberInput({
  value,
  onCommit,
  placeholder,
  decimals = true,
  style,
  accessibilityLabel,
  selectTextOnFocus = true,
  debounceMs = 0,
}: {
  debounceMs?: number;
  value: number | null;
  onCommit: (v: number | null) => void;
  placeholder?: string;
  decimals?: boolean;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  selectTextOnFocus?: boolean;
}) {
  const fmt = (v: number | null) => (v == null ? '' : String(Math.round(v * 100) / 100));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommitted = useRef<number | null>(value);
  const flushRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    lastCommitted.current = value;
    if (!focused.current) setText(fmt(value));
  }, [value]);
  // On unmount, commit anything still pending instead of dropping it.
  useEffect(() => () => flushRef.current?.(), []);
  const cancelPending = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (flushRef.current) pendingCommits.delete(flushRef.current);
    flushRef.current = null;
  };
  const commit = (t: string) => {
    const cleaned = t.trim().replace(',', '.');
    let next: number | null;
    if (cleaned === '') next = null;
    else {
      const n = Number(cleaned);
      if (!Number.isFinite(n)) return; // ignore intermediate input like "-" or "."
      next = decimals ? n : Math.round(n);
    }
    if (next === lastCommitted.current) return;
    lastCommitted.current = next;
    onCommit(next);
  };
  return (
    <TextInput
      value={text}
      onChangeText={(t) => {
        setText(t);
        cancelPending();
        if (debounceMs <= 0) return commit(t);
        const flush = () => {
          cancelPending();
          commit(t);
        };
        flushRef.current = flush;
        pendingCommits.add(flush);
        timer.current = setTimeout(flush, debounceMs);
      }}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        if (flushRef.current) flushRef.current();
        setText(fmt(lastCommitted.current));
      }}
      keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.accent}
      selectTextOnFocus={selectTextOnFocus}
      accessibilityLabel={accessibilityLabel}
      style={[styles.numberInput, font('semibold'), style]}
    />
  );
}

export function Toggle({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.listItem, pressed && styles.pressed]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.toggleTrack, value && { backgroundColor: colors.accent }]}>
        <View style={[styles.toggleThumb, value && { transform: [{ translateX: 20 }], backgroundColor: colors.onAccent }]} />
      </View>
    </Pressable>
  );
}

export function PressableRow(props: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { style, children, ...rest } = props;
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  pressed: { opacity: 0.75 },
  button: {
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, padding: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    minWidth: 0,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: MIN_TOUCH },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontSize: 16,
  },
  numberInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    color: colors.text,
    textAlign: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  toggleTrack: { width: 48, height: 28, borderRadius: 14, backgroundColor: colors.surface, padding: 3, borderWidth: 1, borderColor: colors.border },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textSecondary },
});
