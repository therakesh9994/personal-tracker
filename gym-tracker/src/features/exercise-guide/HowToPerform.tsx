import { useEffect, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { CircleCheck, CircleX, Pause, Play, Snail, TriangleAlert, Wind, type LucideIcon } from 'lucide-react-native';
import { Button, Card, Row, SectionHeader, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { MUSCLE_NAMES, type Muscle } from './drawing';
import { ExerciseAnimation } from './ExerciseAnimation';
import { ANATOMY } from './palette';
import type { ExerciseGuide } from './guides';

function Numbered({ items }: { items: string[] }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((s, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: radius.pill, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>
              {i + 1}
            </Text>
          </View>
          <Text style={{ flex: 1 }}>{s}</Text>
        </Row>
      ))}
    </View>
  );
}

function IconList({ items, icon: Icon, color }: { items: string[]; icon: LucideIcon; color: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {items.map((s, i) => (
        <Row key={i} style={{ alignItems: 'flex-start' }}>
          <Icon color={color} size={16} style={{ marginTop: 2 }} />
          <Text color={colors.textSecondary} style={{ flex: 1 }}>
            {s}
          </Text>
        </Row>
      ))}
    </View>
  );
}

function MuscleLegend({ label, color, muscles }: { label: string; color: string; muscles: Muscle[] }) {
  if (muscles.length === 0) return null;
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 12, height: 12, borderRadius: radius.pill, backgroundColor: color, marginTop: 4 }} />
      <Text style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}: </Text>
        <Text color={colors.textSecondary}>{muscles.map((m) => MUSCLE_NAMES[m]).join(', ')}</Text>
      </Text>
    </Row>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="label" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
      {children}
    </Text>
  );
}

/** "How to perform" card: animated demo plus a step-by-step written guide. */
export function HowToPerform({ guide, exerciseName }: { guide: ExerciseGuide; exerciseName: string }) {
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);

  // Respect the system "Reduce motion" setting: start paused (the user can still press Play).
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (active && reduce) setPlaying(false);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <SectionHeader title="How to perform" />
      <ExerciseAnimation
        key={guide.pattern}
        pattern={guide.pattern}
        muscles={guide.muscles}
        playing={playing}
        speed={slow ? 0.5 : 1}
        accessibilityLabel={`Animated demonstration of ${exerciseName}. Working muscles: ${[...guide.muscles.primary, ...guide.muscles.secondary].map((m) => MUSCLE_NAMES[m]).join(', ')}.`}
      />
      <Row>
        <Button
          title={playing ? 'Pause' : 'Play'}
          icon={playing ? Pause : Play}
          size="sm"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => setPlaying((p) => !p)}
          accessibilityLabel={playing ? 'Pause animation' : 'Play animation'}
        />
        <Button
          title={slow ? 'Normal speed' : 'Slow motion'}
          icon={Snail}
          size="sm"
          variant={slow ? 'primary' : 'secondary'}
          style={{ flex: 1 }}
          onPress={() => setSlow((s) => !s)}
        />
      </Row>
      <View style={{ gap: spacing.xs }}>
        <MuscleLegend label="Primary" color={ANATOMY.primary} muscles={guide.muscles.primary} />
        <MuscleLegend label="Secondary" color={ANATOMY.secondary} muscles={guide.muscles.secondary} />
      </View>

      <Label>Setup</Label>
      <Numbered items={guide.setup} />

      <Label>Each rep</Label>
      <Numbered items={guide.steps} />

      <Label>Breathing</Label>
      <Row style={{ alignItems: 'flex-start' }}>
        <Wind color={colors.textSecondary} size={16} style={{ marginTop: 2 }} />
        <Text color={colors.textSecondary} style={{ flex: 1 }}>
          {guide.breathing}
        </Text>
      </Row>

      <Label>Form cues</Label>
      <IconList items={guide.cues} icon={CircleCheck} color={colors.success} />

      <Label>Common mistakes</Label>
      <IconList items={guide.mistakes} icon={CircleX} color={colors.error} />

      {guide.safety ? (
        <Row style={{ alignItems: 'flex-start', backgroundColor: 'rgba(244,185,66,0.1)', borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.xs }}>
          <TriangleAlert color={colors.warning} size={16} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1 }}>{guide.safety}</Text>
        </Row>
      ) : null}

      <Text variant="caption" color={colors.textSecondary}>
        General guidance, not medical advice. Stop if you feel sharp pain, and start light while you learn the movement.
      </Text>
    </Card>
  );
}
