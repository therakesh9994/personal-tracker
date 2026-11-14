import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { differenceInCalendarDays, format } from 'date-fns';
import { ArrowLeftRight } from 'lucide-react-native';
import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { getPhoto, PHOTO_CATEGORY_LABELS } from '@/features/photos/service';
import type { ProgressPhoto } from '@/database/schema';
import type { WeightUnit } from '@/utils/units';
import { PhotoView } from '@/features/photos/PhotoThumb';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { formatWeight, kgToDisplay, round } from '@/utils/units';

export default function ComparePhotos() {
  const { a, b } = useLocalSearchParams<{ a: string; b: string }>();
  const s = useSettings();
  const { width } = useWindowDimensions();
  const [stacked, setStacked] = useState(false);
  const pa = getPhoto(a);
  const pb = getPhoto(b);
  if (!pa || !pb) return <Screen><EmptyState title="Photos not found" /></Screen>;
  const [before, after] = pa.takenAt <= pb.takenAt ? [pa, pb] : [pb, pa];
  const w = stacked ? width - spacing.lg * 2 : (width - spacing.lg * 2 - spacing.sm) / 2;
  const days = differenceInCalendarDays(after.takenAt, before.takenAt);
  const dW = before.bodyWeightKg != null && after.bodyWeightKg != null ? after.bodyWeightKg - before.bodyWeightKg : null;
  return (
    <Screen>
      <Card>
        <Text variant="heading">
          {days} day{days === 1 ? '' : 's'} apart
        </Text>
        {dW != null ? (
          <Text color={dW > 0 ? colors.warning : colors.success}>
            Body weight change: {dW > 0 ? '+' : ''}
            {round(kgToDisplay(dW, s.weightUnit), 1)} {s.weightUnit}
          </Text>
        ) : null}
      </Card>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.sm }}>
        <PhotoColumn photo={before} label="Before" width={w} weightUnit={s.weightUnit} />
        <PhotoColumn photo={after} label="After" width={w} weightUnit={s.weightUnit} />
      </View>
      <Button title={stacked ? 'Side by side' : 'Stack vertically'} icon={ArrowLeftRight} variant="secondary" onPress={() => setStacked((v) => !v)} />
    </Screen>
  );
}

function PhotoColumn({ photo, label, width, weightUnit }: { photo: ProgressPhoto; label: string; width: number; weightUnit: WeightUnit }) {
  return (
    <View style={{ width, gap: spacing.xs }}>
      <Text variant="label" color={label === 'After' ? colors.accent : colors.textSecondary}>
        {label}
      </Text>
      <PhotoView photo={photo} style={{ width, height: width * 1.33 }} />
      <Text variant="caption">{format(photo.takenAt, 'd MMM yyyy')}</Text>
      <Text variant="caption" color={colors.textSecondary}>
        {PHOTO_CATEGORY_LABELS[photo.category]}
        {photo.bodyWeightKg != null ? ` · ${formatWeight(photo.bodyWeightKg, weightUnit)}` : ''}
      </Text>
    </View>
  );
}
