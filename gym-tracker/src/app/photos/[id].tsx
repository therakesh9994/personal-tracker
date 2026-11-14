import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react-native';
import { Button, Card, Chip, EmptyState, Field, Row, Screen, Text } from '@/components/ui';
import { PHOTO_CATEGORIES } from '@/database/schema';
import { PHOTO_CATEGORY_LABELS, deletePhoto, getPhoto, updatePhoto } from '@/features/photos/service';
import { PhotoView } from '@/features/photos/PhotoThumb';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { confirm, useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { formatWeight } from '@/utils/units';

export default function PhotoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const run = useAction();
  const s = useSettings();
  const { width } = useWindowDimensions();
  const photo = useQuery(() => getPhoto(id), [id]).data;
  const [notes, setNotes] = useState(photo?.notes ?? '');
  if (!photo) return <Screen><EmptyState title="Photo not found" /></Screen>;
  const w = width - spacing.lg * 2;
  return (
    <Screen>
      <PhotoView photo={photo} style={{ width: w, height: w * 1.33 }} contentFit="contain" />
      <Card>
        <Text variant="heading">{format(photo.takenAt, 'EEEE d MMMM yyyy')}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {PHOTO_CATEGORY_LABELS[photo.category]}
          {photo.bodyWeightKg != null ? ` · ${formatWeight(photo.bodyWeightKg, s.weightUnit)}` : ''}
        </Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {PHOTO_CATEGORIES.map((c) => (
            <Chip key={c} label={PHOTO_CATEGORY_LABELS[c]} selected={photo.category === c} onPress={() => run(() => updatePhoto(photo.id, { category: c }))} />
          ))}
        </Row>
        <Field label="Notes" value={notes} onChangeText={setNotes} onBlur={() => run(() => updatePhoto(photo.id, { notes }))} multiline maxLength={500} />
      </Card>
      <Button
        title="Delete photo"
        icon={Trash2}
        variant="danger"
        onPress={async () => {
          if (!(await confirm('Delete photo?', 'The photo file will be permanently removed from this device.'))) return;
          run(() => {
            deletePhoto(photo.id);
            router.back();
          });
        }}
      />
    </Screen>
  );
}
