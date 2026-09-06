import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BodyMetric, BodyReading } from '../src/domain/body/body-metric';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { EmptyState } from '../src/ui/empty-state';
import { formatDateTime } from '../src/ui/format';
import { messageOf } from '../src/ui/message';
import { BusinessNotice } from '../src/ui/notice';
import { NumberField } from '../src/ui/number-field';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import {
  deleteReading,
  listAllReadings,
  listMetrics,
  recordReading,
} from '../src/use-cases/body-actions';

/**
 * Le suivi corporel : ce que le mètre ruban dit, et qu'aucune séance ne peut
 * produire. Une valeur, une date, rien de plus.
 */
export default function BodyScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [readings, setReadings] = useState<BodyReading[]>([]);
  const [recording, setRecording] = useState<BodyMetric | null>(null);
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [allMetrics, allReadings] = await Promise.all([listMetrics(), listAllReadings()]);
    setMetrics(allMetrics);
    setReadings(allReadings);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((e) => setError(messageOf(e)));
    }, [reload]),
  );

  const readingsOf = (metricId: string) => readings.filter((r) => r.metricId === metricId);

  /** La dernière valeur relevée, et l'écart avec celle d'avant. */
  function latest(metricId: string): { reading: BodyReading; change: number | null } | null {
    const own = readingsOf(metricId);
    if (own.length === 0) return null;
    return {
      reading: own[0],
      change: own.length > 1 ? own[0].value - own[1].value : null,
    };
  }

  function open(metric: BodyMetric) {
    // Le champ s'ouvre sur la dernière valeur : on mesure rarement très loin
    // de la fois précédente.
    setValue(latest(metric.id)?.reading.value ?? 0);
    setRecording(metric);
  }

  async function save() {
    if (!recording) return;
    const metric = recording;
    setRecording(null);
    try {
      await recordReading({ metricId: metric.id, value });
      await reload();
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const tracked = metrics.filter((metric) => readingsOf(metric.id).length > 0);
  const untracked = metrics.filter((metric) => readingsOf(metric.id).length === 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pt-4">
        <BackHeader
          title="Mensurations"
          subtitle={`${tracked.length} suivie${tracked.length > 1 ? 's' : ''} · relevées à la main`}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-6">
        {error && <BusinessNotice message={error} />}

        {tracked.length === 0 && (
          <EmptyState
            title="Aucun relevé"
            description="Un tour de cuisse ne sort d'aucune séance : mesure-le, et note-le ici."
          />
        )}

        {tracked.map((metric) => {
          const current = latest(metric.id)!;
          const history = readingsOf(metric.id);

          return (
            <Card key={metric.id} density="titled" className="gap-2">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="shrink font-extrabold text-heading text-ink dark:text-ink-dark">
                  {metric.name}
                </Text>
                <View className="items-end">
                  <Text
                    className="font-mono-bold text-[20px] text-ink dark:text-ink-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {current.reading.value} {metric.unit}
                  </Text>
                  {current.change !== null && (
                    <Text
                      className={
                        current.change >= 0
                          ? 'font-mono text-[12px] text-success dark:text-success-dark'
                          : 'font-mono text-[12px] text-muted dark:text-muted-dark'
                      }
                    >
                      {current.change >= 0 ? '+' : ''}
                      {Math.round(current.change * 10) / 10} depuis le dernier
                    </Text>
                  )}
                </View>
              </View>

              {/* Les relevés précédents, du plus récent au plus ancien. */}
              {history.slice(1, 4).map((reading) => (
                <View key={reading.id} className="flex-row items-center justify-between">
                  <Text className="font-mono text-[12px] text-muted dark:text-muted-dark">
                    {formatDateTime(reading.takenAt)}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <Text className="font-mono text-[13px] text-muted dark:text-muted-dark">
                      {reading.value} {metric.unit}
                    </Text>
                    <Pressable
                      onPress={() =>
                        deleteReading(reading.id)
                          .then(reload)
                          .catch((e) => setError(messageOf(e)))
                      }
                      hitSlop={8}
                    >
                      <Text className="text-[12px] text-danger dark:text-danger-dark">×</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              <Button
                label="Nouveau relevé"
                variant="secondary"
                size="md"
                onPress={() => open(metric)}
              />
            </Card>
          );
        })}

        {untracked.length > 0 && (
          <View className="mt-2 gap-2">
            <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
              Commencer à suivre
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {untracked.map((metric) => (
                <Pressable
                  key={metric.id}
                  onPress={() => open(metric)}
                  className="h-11 justify-center rounded-full border border-border bg-surface px-4 dark:border-border-dark dark:bg-surface-dark"
                >
                  <Text className="text-[13px] text-muted dark:text-muted-dark">{metric.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Sheet
        visible={recording !== null}
        title={recording ? `Relever : ${recording.name}` : ''}
        description="La valeur d'aujourd'hui, prise au mètre ruban ou sur la balance."
        onClose={() => setRecording(null)}
      >
        {recording && (
          <View className="gap-3 pb-2">
            <View className="flex-row gap-3">
              <NumberField
                unit={recording.unit}
                value={value}
                step={recording.unit === 'kg' ? 0.5 : 0.5}
                onChange={setValue}
              />
            </View>
            <Button label="Enregistrer" size="md" onPress={save} />
          </View>
        )}
      </Sheet>
    </SafeAreaView>
  );
}
