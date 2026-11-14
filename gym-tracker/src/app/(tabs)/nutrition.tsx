import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { addDays, format, isToday, startOfDay, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Droplets, Plus, Target, Trash2, Utensils } from 'lucide-react-native';
import { Button, Card, IconButton, ListItem, NumberInput, ProgressBar, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { MEAL_TYPES } from '@/database/schema';
import { MEAL_LABELS, addWater, deleteEntry, deleteWater, getDayNutrition, getDayWater } from '@/features/nutrition/service';
import { entryTotals } from '@/features/nutrition/calculations';
import { getGoalsForDay } from '@/features/settings/service';
import { useQuery } from '@/hooks/useQuery';
import { confirm, useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { formatInt, round } from '@/utils/units';
import { now } from '@/utils/time';

const WATER_QUICK = [150, 250, 500, 750];

/** Timestamp for logging on the selected day: now for today, noon for past days. */
function logTimestamp(day: number): number {
  return isToday(day) ? now() : day + 12 * 3_600_000;
}

export default function NutritionTab() {
  const router = useRouter();
  const run = useAction();
  const [day, setDay] = useState(() => startOfDay(now()).getTime());
  const [customMl, setCustomMl] = useState<number | null>(null);
  const n = useQuery(() => getDayNutrition(day), [day]).data;
  const water = useQuery(() => getDayWater(day), [day]).data;
  const goals = useQuery(() => getGoalsForDay(day), [day]).data;

  if (!n || !water) return <Screen edges={['top']} />;
  const t = n.totals;

  return (
    <Screen edges={['top']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="display">Nutrition</Text>
        <IconButton icon={Target} label="Daily goals" onPress={() => router.push('/nutrition/goals')} />
      </Row>

      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon={ChevronLeft} label="Previous day" onPress={() => setDay((d) => subDays(d, 1).getTime())} />
        <Text variant="heading">{isToday(day) ? 'Today' : format(day, 'EEE d MMM yyyy')}</Text>
        <IconButton icon={ChevronRight} label="Next day" disabled={isToday(day)} onPress={() => setDay((d) => addDays(d, 1).getTime())} />
      </Row>

      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text variant="label" color={colors.textSecondary}>
              Calories
            </Text>
            <Text variant="display" style={{ fontSize: 34 }}>{formatInt(t.calories)}</Text>
          </View>
          <Text color={colors.textSecondary}>
            {goals?.calories
              ? t.calories <= goals.calories
                ? `${formatInt(goals.calories - t.calories)} kcal left of ${formatInt(goals.calories)}`
                : `${formatInt(t.calories - goals.calories)} kcal over ${formatInt(goals.calories)}`
              : 'No calorie goal'}
          </Text>
        </Row>
        {goals?.calories ? <ProgressBar progress={t.calories / goals.calories} height={10} /> : null}
        <Row gap={spacing.md}>
          <Macro label="Protein" value={t.protein} goal={goals?.proteinG} color={colors.series[1]} />
          <Macro label="Carbs" value={t.carbs} goal={goals?.carbsG} color={colors.series[2]} />
          <Macro label="Fat" value={t.fat} goal={goals?.fatG} color={colors.series[4]} />
        </Row>
        {!goals ? <Button title="Set daily goals" size="sm" variant="secondary" onPress={() => router.push('/nutrition/goals')} /> : null}
      </Card>

      {MEAL_TYPES.map((meal) => {
        const entries = n.entries.filter((e) => e.meal === meal);
        return (
          <Card key={meal} style={{ paddingVertical: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="heading">{MEAL_LABELS[meal]}</Text>
              <Row>
                <Text variant="caption" color={colors.textSecondary}>
                  {formatInt(n.byMeal[meal].calories)} kcal
                </Text>
                <IconButton
                  icon={Plus}
                  label={`Add food to ${MEAL_LABELS[meal]}`}
                  size={34}
                  background={colors.accentMuted}
                  color={colors.accent}
                  onPress={() => router.push({ pathname: '/nutrition/foods', params: { meal, day: String(logTimestamp(day)) } })}
                />
              </Row>
            </Row>
            {entries.map((e) => {
              const et = entryTotals(e);
              return (
                <ListItem
                  key={e.id}
                  title={e.foodName}
                  subtitle={`${round(e.quantity * e.servingSize, 1)} ${e.servingUnit} · P ${round(et.protein, 1)} · C ${round(et.carbs, 1)} · F ${round(et.fat, 1)}`}
                  onPress={() => router.push({ pathname: '/nutrition/log', params: { entryId: e.id } })}
                  onLongPress={async () => (await confirm('Delete entry?', `${e.foodName} will be removed from ${MEAL_LABELS[meal]}.`)) && run(() => deleteEntry(e.id))}
                  right={
                    <Text variant="bodyStrong" color={colors.textSecondary}>
                      {Math.round(et.calories)}
                    </Text>
                  }
                />
              );
            })}
          </Card>
        );
      })}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Droplets color="#5CC8FF" size={20} />
            <Text variant="heading">Water</Text>
          </Row>
          <Text variant="bodyStrong">
            {formatInt(water.totalMl)} {goals?.waterMl ? `/ ${formatInt(goals.waterMl)}` : ''} ml
          </Text>
        </Row>
        {goals?.waterMl ? <ProgressBar progress={water.totalMl / goals.waterMl} color="#5CC8FF" /> : null}
        <Row style={{ flexWrap: 'wrap' }}>
          {WATER_QUICK.map((ml) => (
            <Button key={ml} title={`+${ml}`} size="sm" variant="secondary" style={{ flexGrow: 1 }} onPress={() => run(() => addWater(ml, logTimestamp(day)))} accessibilityLabel={`Add ${ml} milliliters`} />
          ))}
        </Row>
        <Row>
          <NumberInput value={customMl} onCommit={setCustomMl} decimals={false} placeholder="Custom ml" style={{ flex: 1 }} accessibilityLabel="Custom water amount in milliliters" />
          <Button
            title="Add"
            size="sm"
            disabled={!customMl}
            onPress={() =>
              run(() => {
                addWater(customMl!, logTimestamp(day));
                setCustomMl(null);
              })
            }
          />
        </Row>
        {water.logs.slice(0, 5).map((l) => (
          <Row key={l.id} style={{ justifyContent: 'space-between' }}>
            <Text variant="caption" color={colors.textSecondary}>
              {format(l.loggedAt, 'HH:mm')} · {l.amountMl} ml
            </Text>
            <IconButton icon={Trash2} label={`Delete ${l.amountMl} ml entry`} size={30} background="transparent" color={colors.textSecondary} onPress={() => run(() => deleteWater(l.id))} />
          </Row>
        ))}
        <Button title="Water history" size="sm" variant="ghost" onPress={() => router.push('/nutrition/water')} />
      </Card>

      <SectionHeader title="Foods" />
      <Button title="Manage my foods" icon={Utensils} variant="secondary" onPress={() => router.push('/nutrition/foods')} />
      <Text variant="caption" color={colors.textSecondary}>
        Long-press an entry to delete it. Goals are personal targets you set yourself — consult a professional for medical or dietary advice.
      </Text>
    </Screen>
  );
}

function Macro({ label, value, goal, color }: { label: string; value: number; goal: number | null | undefined; color: string }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyStrong">
        {Math.round(value)}
        {goal ? <Text variant="caption" color={colors.textSecondary}>{` / ${Math.round(goal)}g`}</Text> : 'g'}
      </Text>
      {goal ? <ProgressBar progress={value / goal} color={color} height={6} /> : null}
    </View>
  );
}
