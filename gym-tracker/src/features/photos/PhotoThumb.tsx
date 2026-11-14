import { View } from 'react-native';
import { Image } from 'expo-image';
import { ImageOff } from 'lucide-react-native';
import { Text } from '@/components/ui';
import type { ProgressPhoto } from '@/database/schema';
import { colors, radius } from '@/theme';
import { photoExists, photoUri } from './service';

/** Displays a local photo; expo-image downsamples to the view size, so full-resolution bitmaps are not held in memory. */
export function PhotoView({ photo, style, contentFit = 'cover' }: { photo: ProgressPhoto; style?: object; contentFit?: 'cover' | 'contain' }) {
  if (!photoExists(photo)) {
    return (
      <View style={[{ backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, gap: 4 }, style]}>
        <ImageOff color={colors.textSecondary} size={22} />
        <Text variant="caption" color={colors.textSecondary}>
          File missing
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: photoUri(photo) }}
      style={[{ borderRadius: radius.md, backgroundColor: colors.surface }, style]}
      contentFit={contentFit}
      recyclingKey={photo.id}
      allowDownscaling
      transition={150}
      accessibilityLabel={`Progress photo, ${photo.category}`}
    />
  );
}
