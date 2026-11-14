import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Button, Card, Chip, ErrorText, Field, NumberInput, Row, Screen, Text } from '@/components/ui';
import { getProfile, updateProfile } from '@/features/settings/service';
import { useSettings } from '@/hooks/useSettings';
import { colors, spacing } from '@/theme';
import { cmToDisplay, displayToCm, round } from '@/utils/units';
import { errorMessage } from '@/utils/errors';

const SEXES = [
  { key: 'unspecified', label: 'Prefer not to say' },
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other' },
] as const;

export default function ProfileSettings() {
  const router = useRouter();
  const s = useSettings();
  const p = getProfile();
  const [name, setName] = useState(p.name ?? '');
  const [height, setHeight] = useState<number | null>(p.heightCm != null ? round(cmToDisplay(p.heightCm, s.lengthUnit), 1) : null);
  const [birth, setBirth] = useState(p.birthDate ? format(p.birthDate, 'yyyy-MM-dd') : '');
  const [sex, setSex] = useState(p.sex ?? 'unspecified');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    try {
      let birthDate: number | null = null;
      if (birth.trim()) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.trim());
        const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
        if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) throw new Error('Enter birth date as YYYY-MM-DD.');
        birthDate = d.getTime();
      }
      updateProfile({ name: name.trim() || null, heightCm: height == null ? null : displayToCm(height, s.lengthUnit), birthDate, sex });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen>
      <Card>
        <Field label="Name (optional)" value={name} onChangeText={setName} maxLength={60} />
        <View style={{ gap: spacing.xs }}>
          <Text variant="label" color={colors.textSecondary}>
            Height ({s.lengthUnit})
          </Text>
          <NumberInput value={height} onCommit={setHeight} placeholder="–" style={{ minHeight: 48, textAlign: 'left', paddingHorizontal: spacing.md }} />
        </View>
        <Field label="Birth date (YYYY-MM-DD, optional)" value={birth} onChangeText={setBirth} placeholder="1990-04-21" keyboardType="numbers-and-punctuation" maxLength={10} />
        <Text variant="label" color={colors.textSecondary}>
          Sex (optional)
        </Text>
        <Row style={{ flexWrap: 'wrap' }}>
          {SEXES.map((x) => (
            <Chip key={x.key} label={x.label} selected={sex === x.key} onPress={() => setSex(x.key)} />
          ))}
        </Row>
        <Text variant="caption" color={colors.textSecondary}>
          Body weight is tracked in Body measurements so its history is kept.
        </Text>
      </Card>
      <ErrorText message={error} />
      <Button title="Save" onPress={save} />
    </Screen>
  );
}
