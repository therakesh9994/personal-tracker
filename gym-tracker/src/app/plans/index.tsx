import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ClipboardList, Copy, Plus } from 'lucide-react-native';
import { Button, Card, EmptyState, ErrorText, Field, Row, Screen, SectionHeader, Text } from '@/components/ui';
import { createPlan, duplicatePlan, listPlans } from '@/features/plans/service';
import { useQuery } from '@/hooks/useQuery';
import { useAction } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function PlansScreen() {
  const router = useRouter();
  const run = useAction();
  const plans = useQuery(listPlans).data ?? [];
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mine = plans.filter((p) => !p.isTemplate);
  const templates = plans.filter((p) => p.isTemplate);

  const create = () => {
    try {
      const id = createPlan({ name });
      setName('');
      setError(null);
      router.push({ pathname: '/plans/[id]', params: { id } });
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const PlanCard = ({ p }: { p: (typeof plans)[number] }) => (
    <Card onPress={() => router.push({ pathname: '/plans/[id]', params: { id: p.id } })} accessibilityLabel={`Plan ${p.name}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading" style={{ flex: 1 }}>
          {p.name}
        </Text>
        <Button
          title="Duplicate"
          icon={Copy}
          size="sm"
          variant="ghost"
          onPress={() =>
            run(() => {
              const id = duplicatePlan(p.id);
              router.push({ pathname: '/plans/[id]', params: { id } });
            })
          }
        />
      </Row>
      {p.description ? (
        <Text variant="caption" color={colors.textSecondary}>
          {p.description}
        </Text>
      ) : null}
      <Text variant="caption" color={colors.accent}>
        {p.dayCount} days · {p.exerciseCount} exercises
      </Text>
    </Card>
  );

  return (
    <Screen>
      <Card>
        <SectionHeader title="Create a custom plan" />
        <Row style={{ alignItems: 'flex-start' }}>
          <Field placeholder="Plan name" value={name} onChangeText={setName} style={{ flex: 1 }} onSubmitEditing={create} returnKeyType="done" />
          <Button title="Create" icon={Plus} onPress={create} />
        </Row>
        <ErrorText message={error} />
      </Card>

      <SectionHeader title="My plans" />
      {mine.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No custom plans yet" message="Create one above, or duplicate a template below to customise it." />
        </Card>
      ) : (
        mine.map((p) => <PlanCard key={p.id} p={p} />)
      )}

      <SectionHeader title="Suggested templates" />
      <Text variant="caption" color={colors.textSecondary} style={{ marginTop: -spacing.sm }}>
        Templates are editable. Starting a workout from a plan never changes the plan.
      </Text>
      {templates.map((p) => (
        <PlanCard key={p.id} p={p} />
      ))}
    </Screen>
  );
}
