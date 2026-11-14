import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { Text } from './ui';

export interface SheetOption {
  key: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
}

/** Cross-platform bottom sheet with a list of options (Android Alert supports only 3 buttons). */
export function OptionSheet({
  visible,
  title,
  message,
  options,
  onSelect,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  options?: SheetOption[];
  onSelect?: (key: string) => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.grabber} />
        {title ? (
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {title}
          </Text>
        ) : null}
        {message ? (
          <Text variant="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            {message}
          </Text>
        ) : null}
        {children}
        {options ? (
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => (
              <Pressable
                key={o.key}
                disabled={o.disabled}
                onPress={() => {
                  onClose();
                  onSelect?.(o.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: !!o.selected, disabled: !!o.disabled }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surface }, o.disabled && { opacity: 0.4 }]}
              >
                {o.icon ? <o.icon color={o.destructive ? colors.error : o.selected ? colors.accent : colors.text} size={20} /> : null}
                <Text variant="bodyStrong" color={o.destructive ? colors.error : o.selected ? colors.accent : colors.text} style={{ flex: 1 }}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text variant="bodyStrong" color={colors.textSecondary}>
            Close
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surface },
});
