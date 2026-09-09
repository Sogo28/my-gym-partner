import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ConditionResult, RequirementEvaluation } from '../domain/goal/evaluation';
import type { GoalSubject, ProgressionStep } from '../domain/goal/goal';
import { cn } from './cn';
import { describeCondition, describeDemand, WINDOW_PHRASES } from './goal-labels';

/**
 * Une progression, lue comme un chemin.
 *
 * Le rail remplace la carte « étape en cours » ET la liste des étapes, qui
 * disaient la même chose à deux endroits. Surtout, il replace ce qui reste à
 * faire LÀ OÙ l'on se trouve : les conditions de l'étape en cours étaient
 * jusqu'ici dans une carte détachée, à l'autre bout de la page.
 *
 * Trait plein au-dessus, pointillé en dessous : le chemin parcouru et celui
 * qui reste. C'est déjà le vocabulaire des séries, où le pointillé annonce ce
 * qui est prévu et le plein ce qui est fait.
 */
export function GoalProgression({
  steps,
  currentIndex,
  evaluation,
  subjectName,
  unitOf,
  onOpen,
  action,
}: {
  steps: readonly ProgressionStep[];
  currentIndex: number;
  /** L'évaluation de l'étape en cours, seule à en avoir une. */
  evaluation: RequirementEvaluation | null;
  subjectName: (subject: GoalSubject) => string;
  unitOf: (measurementId: string) => string;
  /** Aller voir ce que l'étape vise : sa fiche dit ce que le rail ne dit pas. */
  onOpen?: (subject: GoalSubject) => void;
  /** Ce que l'étape en cours propose de faire. Composé par l'écran. */
  action?: ReactNode;
}) {
  return (
    <View>
      {steps.map((step, index) => {
        const state = index < currentIndex ? 'past' : index === currentIndex ? 'current' : 'todo';

        return (
          <View key={index} className="flex-row gap-3">
            <Rail state={state} first={index === 0} last={index === steps.length - 1} />

            <View className={cn('flex-1', state === 'current' ? 'pb-5' : 'pb-3')}>
              <Pressable
                disabled={!onOpen}
                onPress={() => onOpen?.(step.subject)}
                className="flex-row items-center gap-2"
              >
                <Text
                  className={cn(
                    'shrink',
                    state === 'past'
                      ? 'text-lead text-muted line-through dark:text-muted-dark'
                      : state === 'current'
                        ? 'font-extrabold text-heading text-ink dark:text-ink-dark'
                        : 'text-lead text-ink dark:text-ink-dark',
                  )}
                  numberOfLines={1}
                >
                  {index + 1}. {subjectName(step.subject)}
                </Text>
              </Pressable>

              {/* L'étape en cours porte ses conditions ; celles qui suivent
                  annoncent seulement ce qu'elles demanderont. */}
              {state === 'current' && (
                <View className="gap-3 pt-2">
                  {evaluation === null ? (
                    <Text className="text-small text-muted dark:text-muted-dark">
                      Cette étape n a pas de condition : à valider toi-même.
                    </Text>
                  ) : (
                    evaluation.results.map((result, position) => (
                      <ConditionProgress key={position} result={result} unitOf={unitOf} />
                    ))
                  )}
                  {action}
                </View>
              )}

              {state === 'todo' && (
                <Text className="pt-0.5 font-mono text-small text-planned dark:text-planned-dark">
                  {describeDemand(step.requirements, unitOf) || 'à valider à la main'}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Le trait et le point : à gauche, sur toute la hauteur de l'étape. */
function Rail({
  state,
  first,
  last,
}: {
  state: 'past' | 'current' | 'todo';
  first: boolean;
  last: boolean;
}) {
  return (
    <View className="w-4 items-center">
      <Segment hidden={first} travelled={state !== 'todo'} height={10} />
      <Dot state={state} />
      {/* Le segment du bas s'étire : c'est lui qui relie l'étape suivante,
          quelle que soit la hauteur de celle-ci. */}
      <Segment hidden={last} travelled={state === 'past'} grow />
    </View>
  );
}

function Segment({
  hidden,
  travelled,
  height,
  grow,
}: {
  hidden: boolean;
  travelled: boolean;
  height?: number;
  grow?: boolean;
}) {
  return (
    <View
      className={cn(grow && 'flex-1', hidden && 'opacity-0')}
      style={{
        width: 0,
        height,
        // Une bordure gauche sur une vue sans largeur : c'est ainsi qu'on
        // obtient un trait pointillé, que RN ne sait pas dessiner autrement.
        borderLeftWidth: 2,
        borderStyle: travelled ? 'solid' : 'dashed',
        borderLeftColor: travelled ? '#46600F' : '#A8AD9E',
      }}
    />
  );
}

function Dot({ state }: { state: 'past' | 'current' | 'todo' }) {
  if (state === 'current') {
    return (
      <View className="h-4 w-4 items-center justify-center rounded-full border-[3px] border-primary-ink dark:border-primary-ink-dark" />
    );
  }
  return (
    <View
      className={cn(
        'h-3 w-3 rounded-full',
        state === 'past'
          ? 'bg-primary-ink dark:bg-primary-ink-dark'
          : 'border-2 border-planned bg-background dark:bg-background-dark',
      )}
    />
  );
}

/**
 * Une condition de l'étape en cours : ce qu'elle demande, où en est-on, et
 * quelle période a servi à le dire.
 */
export function ConditionProgress({
  result,
  unitOf,
}: {
  result: ConditionResult;
  unitOf: (measurementId: string) => string;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-end justify-between gap-3">
        <Text className="shrink text-small text-muted dark:text-muted-dark">
          {describeCondition(result.condition, unitOf)}
        </Text>
        <Text
          className={cn(
            'font-mono-bold text-lead',
            result.satisfied
              ? 'text-success dark:text-success-dark'
              : 'text-ink dark:text-ink-dark',
          )}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {result.actual === null ? '—' : Math.round(result.actual * 10) / 10}
        </Text>
      </View>

      <Gauge ratio={ratioOf(result)} satisfied={result.satisfied} />

      <Text className="font-mono text-caption text-planned dark:text-planned-dark">
        {WINDOW_PHRASES[result.condition.window]}
        {result.hasData ? '' : ' · aucune donnée'}
      </Text>
    </View>
  );
}

function Gauge({ ratio, satisfied }: { ratio: number; satisfied: boolean }) {
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-surface-alt dark:bg-surface-alt-dark">
      <View
        className={cn(
          'h-full rounded-full',
          satisfied ? 'bg-success dark:bg-success-dark' : 'bg-primary-ink dark:bg-primary-ink-dark',
        )}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </View>
  );
}

/**
 * Où l'on en est, entre 0 et 1.
 *
 * Une condition satisfaite est pleine, quel que soit son opérateur : c'est le
 * seul moyen honnête de traiter « au plus 70 kg », où l'on progresse en
 * DESCENDANT et où actuel / cible dirait l'inverse de la vérité.
 */
function ratioOf(result: ConditionResult): number {
  if (result.satisfied) return 1;
  if (result.actual === null || result.condition.target === 0) return 0;

  const downwards = result.condition.operator === '<' || result.condition.operator === '<=';
  const ratio = downwards
    ? result.condition.target / result.actual
    : result.actual / result.condition.target;

  return Math.min(Math.max(ratio, 0), 1);
}
