import { useState } from 'react';
import { Alert, FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, GitCompare, ImagePlus, Images } from 'lucide-react-native';
import { OptionSheet } from '@/components/OptionSheet';
import { Button, Chip, ChipRow, EmptyState, IconButton, NumberInput, Row, Segmented, Text, Field } from '@/components/ui';
import { PHOTO_CATEGORIES, type PhotoCategory } from '@/database/schema';
import { PHOTO_CATEGORY_LABELS, addPhoto, listPhotos } from '@/features/photos/service';
import { PhotoView } from '@/features/photos/PhotoThumb';
import { latestWeight } from '@/features/measurements/service';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { RANGE_OPTIONS, rangeStart, type RangeKey } from '@/utils/time';
import { displayToKg, kgToDisplay, round } from '@/utils/units';
import { errorMessage } from '@/utils/errors';

export default function PhotosScreen() {
  const router = useRouter();
  const settings = useSettings();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<PhotoCategory | null>(null);
  const [range, setRange] = useState<RangeKey>('all');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sourceSheet, setSourceSheet] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const photos = useQuery(() => listPhotos({ category, from: range === 'all' ? undefined : rangeStart(range) }), [category, range]).data ?? [];
  const size = Math.floor((width - spacing.lg * 2 - spacing.sm * 2) / 3);

  const pick = async (source: 'camera' | 'library') => {
    try {
      const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', source === 'camera' ? 'Allow camera access in system settings to take progress photos.' : 'Allow photo library access in system settings to choose photos.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false, exif: false };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      setPending(res.assets[0].uri);
    } catch (e) {
      Alert.alert('Could not open photos', errorMessage(e));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <IconButton icon={ImagePlus} label="Add photo" onPress={() => setSourceSheet(true)} size={34} background="transparent" color={colors.accent} /> }} />
      <FlatList
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxxl }}
        columnWrapperStyle={{ gap: spacing.sm }}
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        initialNumToRender={18}
        windowSize={5}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <ChipRow options={PHOTO_CATEGORIES.map((c) => ({ key: c, label: PHOTO_CATEGORY_LABELS[c] }))} value={category} onChange={setCategory} allowNone />
            <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
            <Row>
              <Button title="Add photo" icon={Camera} size="sm" style={{ flex: 1 }} onPress={() => setSourceSheet(true)} />
              <Button
                title={selecting ? (selected.length === 2 ? 'Compare' : `Select ${2 - selected.length}`) : 'Compare'}
                icon={GitCompare}
                size="sm"
                variant={selecting ? 'primary' : 'secondary'}
                style={{ flex: 1 }}
                disabled={photos.length < 2}
                onPress={() => {
                  if (!selecting) return setSelecting(true);
                  if (selected.length === 2) {
                    router.push({ pathname: '/photos/compare', params: { a: selected[0], b: selected[1] } });
                    setSelecting(false);
                    setSelected([]);
                  } else {
                    setSelecting(false);
                    setSelected([]);
                  }
                }}
              />
            </Row>
            <Text variant="caption" color={colors.textSecondary}>
              Photos are stored privately on this device and never uploaded.
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={Images} title="No progress photos" message="Take consistent photos (same light, pose and distance) to see changes over time." action="Add photo" onAction={() => setSourceSheet(true)} />}
        renderItem={({ item }) => {
          const isSel = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => {
                if (!selecting) return router.push({ pathname: '/photos/[id]', params: { id: item.id } });
                setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id].slice(-2)));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${PHOTO_CATEGORY_LABELS[item.category]} photo from ${format(item.takenAt, 'PPP')}`}
              accessibilityState={{ selected: isSel }}
            >
              <PhotoView photo={item} style={{ width: size, height: size * 1.33, borderWidth: isSel ? 2 : 0, borderColor: colors.accent }} />
              {isSel ? (
                <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.accent, borderRadius: 12, padding: 2 }}>
                  <Check color={colors.onAccent} size={16} />
                </View>
              ) : null}
              <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                {format(item.takenAt, 'd MMM yy')}
              </Text>
            </Pressable>
          );
        }}
      />
      <OptionSheet
        visible={sourceSheet}
        title="Add progress photo"
        onClose={() => setSourceSheet(false)}
        options={[
          { key: 'camera', label: 'Take photo', icon: Camera },
          { key: 'library', label: 'Choose from library', icon: Images },
        ]}
        onSelect={(k) => setTimeout(() => void pick(k as 'camera' | 'library'), 400)}
      />
      <NewPhotoSheet uri={pending} onClose={() => setPending(null)} unit={settings.weightUnit} />
    </>
  );
}

function NewPhotoSheet({ uri, onClose, unit }: { uri: string | null; onClose: () => void; unit: 'kg' | 'lb' }) {
  const [category, setCategory] = useState<PhotoCategory>('front');
  const lw = useQuery(latestWeight).data;
  const [weight, setWeight] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const shownWeight = weight ?? (lw ? round(kgToDisplay(lw.weightKg, unit), 1) : null);
  const save = async () => {
    if (!uri) return;
    setSaving(true);
    try {
      await addPhoto({ sourceUri: uri, category, takenAt: Date.now(), bodyWeightKg: shownWeight != null ? displayToKg(shownWeight, unit) : null, notes });
      setNotes('');
      setWeight(null);
      onClose();
    } catch (e) {
      Alert.alert('Could not save photo', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <OptionSheet visible={uri != null} title="Photo details" onClose={onClose}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PHOTO_CATEGORIES.map((c) => (
          <Chip key={c} label={PHOTO_CATEGORY_LABELS[c]} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <Row>
        <Text style={{ flex: 1 }}>Body weight ({unit}, optional)</Text>
        <NumberInput value={shownWeight} onCommit={setWeight} placeholder="–" style={{ width: 90 }} />
      </Row>
      <Field placeholder="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={500} />
      <Button title="Save photo" onPress={save} loading={saving} />
    </OptionSheet>
  );
}
