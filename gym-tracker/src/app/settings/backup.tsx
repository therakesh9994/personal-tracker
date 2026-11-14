import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { format } from 'date-fns';
import { CheckCircle2, Database, FileDown, FolderOpen, RotateCcw, Share2, ShieldAlert, Trash2 } from 'lucide-react-native';
import { OptionSheet } from '@/components/OptionSheet';
import { Button, Card, Chip, EmptyState, Row, Screen, SectionHeader, Segmented, Text, Toggle } from '@/components/ui';
import {
  EXPORT_LABELS,
  createLocalBackup,
  deleteLocalBackup,
  exportData,
  listLocalBackups,
  pickBackupFile,
  restoreParsedBackup,
  shareLocalBackup,
  verifyLocalBackup,
  type ExportKind,
  type LocalBackup,
} from '@/features/backup/service';
import { totalRecords, type ParsedBackup } from '@/features/backup/format';
import { updateSettings } from '@/features/settings/service';
import type { RestoreMode } from '@/features/backup/repository';
import { useQuery } from '@/hooks/useQuery';
import { useSettings } from '@/hooks/useSettings';
import { confirm } from '@/hooks/useAction';
import { colors, spacing } from '@/theme';
import { errorMessage } from '@/utils/errors';

const fmtSize = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
const KIND_LABEL: Record<LocalBackup['kind'], string> = { auto: 'Automatic', manual: 'Manual', pre_restore: 'Before restore' };

export default function BackupScreen() {
  const s = useSettings();
  const backups = useQuery(listLocalBackups).data ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ParsedBackup | null>(null);

  const guarded = async (label: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (parsed: ParsedBackup, mode: RestoreMode) => {
    const ok = await confirm(
      mode === 'replace' ? 'Replace all data?' : 'Merge backup?',
      mode === 'replace'
        ? 'All current workouts, nutrition, measurements and photos will be replaced by the backup. A safety backup of your current data is created first.'
        : 'Records from the backup that are not on this device will be added. Existing records are kept unchanged. A safety backup is created first.',
      mode === 'replace' ? 'Replace' : 'Merge',
    );
    if (!ok) return;
    setCandidate(null);
    await guarded('restore', async () => {
      const r = await restoreParsedBackup(parsed, mode);
      Alert.alert(
        'Restore complete',
        `${r.inserted} records restored${r.skippedDuplicates ? `, ${r.skippedDuplicates} duplicates skipped` : ''}. ${r.photosRestored} photos restored.${r.photosMissing ? ` ${r.photosMissing} photo files are missing.` : ''}${
          r.openSessionsResolved ? ` ${r.openSessionsResolved} extra in-progress workout(s) were closed so only one stays open.` : ''
        }`,
      );
    });
  };

  return (
    <Screen>
      {busy === 'restore' ? (
        <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderColor: colors.accent, borderWidth: 1 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ flex: 1 }}>Restoring your data… keep the app open.</Text>
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <ShieldAlert color={colors.warning} size={22} />
        <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
          Backups contain your personal health and fitness data and are not encrypted. Store exported files somewhere private and only share them with people you trust.
        </Text>
      </Card>

      <SectionHeader title="Automatic backups" />
      <Card>
        <Toggle
          label="Automatic local backups"
          description="Saved privately on this device at safe moments (app launch, app moving to background, after a workout). Mobile systems limit background work, so backups run when the app is used."
          value={s.autoBackupEnabled}
          onChange={(v) => updateSettings({ autoBackupEnabled: v })}
        />
        {s.autoBackupEnabled ? (
          <>
            <Text variant="bodyStrong">Frequency</Text>
            <Segmented
              options={[
                { key: 'daily', label: 'Daily' },
                { key: 'weekly', label: 'Weekly' },
                { key: 'after_workout', label: 'After workout' },
              ]}
              value={s.autoBackupFrequency}
              onChange={(v) => updateSettings({ autoBackupFrequency: v })}
            />
            <Text variant="bodyStrong">Keep</Text>
            <Row>
              {[3, 7, 14, 30].map((n) => (
                <Chip key={n} label={`${n} backups`} selected={s.backupRetention === n} onPress={() => updateSettings({ backupRetention: n })} />
              ))}
            </Row>
          </>
        ) : null}
        <Text variant="caption" color={colors.textSecondary}>
          Last automatic backup: {s.lastAutoBackupAt ? format(s.lastAutoBackupAt, 'd MMM yyyy, HH:mm') : 'never'}. Automatic backups contain your data; photos are included in manual full backups.
        </Text>
        <Button title="Back up now (with photos)" icon={Database} loading={busy === 'backup'} onPress={() => guarded('backup', async () => void (await createLocalBackup('manual', true)))} />
      </Card>

      <SectionHeader title="Backups on this device" />
      {backups.length === 0 ? (
        <Card>
          <EmptyState icon={Database} title="No backups yet" />
        </Card>
      ) : (
        backups.map((b) => (
          <Card key={b.id} style={{ gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="bodyStrong">{format(b.createdAt, 'd MMM yyyy, HH:mm')}</Text>
              <Text variant="caption" color={b.fileExists ? colors.textSecondary : colors.error}>
                {b.fileExists ? fmtSize(b.sizeBytes) : 'File missing'}
              </Text>
            </Row>
            <Text variant="caption" color={colors.textSecondary}>
              {KIND_LABEL[b.kind]} · {b.recordCount} records · {b.includesPhotos ? 'with photos' : 'data only'} · schema v{b.schemaVersion}
            </Text>
            <Row>
              <Button
                title="Verify"
                icon={CheckCircle2}
                size="sm"
                variant="secondary"
                disabled={!b.fileExists}
                onPress={() =>
                  guarded('verify', async () => {
                    const p = await verifyLocalBackup(b.id);
                    Alert.alert('Backup is valid', `${totalRecords(p.manifest)} records${p.photos.size ? ` and ${p.photos.size} photos` : ''} passed integrity checks.`);
                  })
                }
              />
              <Button
                title="Restore"
                icon={RotateCcw}
                size="sm"
                variant="secondary"
                disabled={!b.fileExists}
                onPress={() => guarded('open', async () => setCandidate(await verifyLocalBackup(b.id)))}
              />
              <Button title="" icon={Share2} size="sm" variant="ghost" disabled={!b.fileExists} accessibilityLabel="Share backup" onPress={() => guarded('share', () => shareLocalBackup(b.id))} />
              <Button
                title=""
                icon={Trash2}
                size="sm"
                variant="ghost"
                accessibilityLabel="Delete backup"
                onPress={async () => (await confirm('Delete backup?', 'This backup file will be removed from the device.')) && deleteLocalBackup(b.id)}
              />
            </Row>
          </Card>
        ))
      )}

      <SectionHeader title="Export" />
      <Card style={{ gap: spacing.sm }}>
        {(Object.keys(EXPORT_LABELS) as ExportKind[]).map((k) => (
          <Button key={k} title={EXPORT_LABELS[k]} icon={FileDown} variant="secondary" loading={busy === k} onPress={() => guarded(k, () => exportData(k))} />
        ))}
        <Text variant="caption" color={colors.textSecondary}>
          The ZIP and JSON exports can be imported back into Gym Tracker. CSV files are for spreadsheets. Values are in kg, cm and ml.
        </Text>
      </Card>

      <SectionHeader title="Restore from file" />
      <Card>
        <Text variant="caption" color={colors.textSecondary}>
          Choose a Gym Tracker .zip or .json backup. It is fully validated before anything changes, and nothing is overwritten without your confirmation.
        </Text>
        <Button
          title="Choose backup file"
          icon={FolderOpen}
          loading={busy === 'pick'}
          onPress={() =>
            guarded('pick', async () => {
              const parsed = await pickBackupFile();
              if (parsed) setCandidate(parsed);
            })
          }
        />
      </Card>

      <OptionSheet visible={candidate != null} title="Backup ready to restore" onClose={() => setCandidate(null)}>
        {candidate ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="caption" color={colors.textSecondary}>
              Created {format(candidate.manifest.createdAt, 'd MMM yyyy, HH:mm')} · app {candidate.manifest.appVersion} · schema v{candidate.manifest.schemaVersion}
            </Text>
            <Text>
              {candidate.manifest.counts.workout_sessions ?? 0} workouts · {candidate.manifest.counts.workout_sets ?? 0} sets · {candidate.manifest.counts.nutrition_entries ?? 0} food entries ·{' '}
              {candidate.manifest.counts.body_measurements ?? 0} measurements · {candidate.photos.size} photos
            </Text>
            {candidate.manifest.missingPhotos.length ? (
              <Text variant="caption" color={colors.warning}>
                {candidate.manifest.missingPhotos.length} photos were missing when this backup was made.
              </Text>
            ) : null}
            <Button title="Replace current data" variant="danger" onPress={() => restore(candidate, 'replace')} />
            <Button title="Merge (add missing records)" variant="secondary" onPress={() => restore(candidate, 'merge')} />
          </View>
        ) : null}
      </OptionSheet>
    </Screen>
  );
}
