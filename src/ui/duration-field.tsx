import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { cn } from './cn';
import { formatDuration } from './format';
import { Sheet } from './sheet';

/** La hauteur d'un cran. Trois tiennent dans la fenêtre : le choisi, et ses voisins. */
const ITEM = 44;
const VISIBLE = 3;

/**
 * Une durée se règle à la roulette, pas au compteur.
 *
 * Trois minutes de corde à sauter font cent quatre-vingts pas d'une seconde :
 * le compteur, juste pour des répétitions ou des kilos, ne mène nulle part
 * sur une mesure dont l'étendue va de cinq secondes à cinq minutes.
 *
 * La roulette est écrite ici et non prise ailleurs, pour deux raisons. Le
 * composant standard rend bien une roulette sur iOS mais une liste déroulante
 * sur Android -- pas ce qu'on veut. Et toute bibliothèque tierce serait un
 * module natif, donc une reconstruction à chaque correction : celle-ci n'est
 * que du JavaScript, et part par une mise à jour.
 */
export function DurationField({
  value,
  onChange,
  label,
  compact = false,
  onDone,
}: {
  /** En secondes : c'est ainsi qu'une durée est mesurée et stockée. */
  value: number;
  onChange: (seconds: number) => void;
  label?: string;
  compact?: boolean;
  /**
   * Appelé en refermant la roulette.
   *
   * Pour une durée, la roulette EST tout le réglage : une fois la valeur
   * choisie, il n'y a plus rien à faire sur cette série. L'écran qui la
   * tenait ouverte peut donc la relâcher, au lieu d'attendre un second geste
   * qui ne dirait rien de plus.
   */
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      {/* La même empreinte qu'un compteur : la durée se lit en place, et la
          roulette n'apparaît que si on la demande. Sans cela, elle
          bousculerait toutes les rangées où les mesures voisinent. */}
      <Pressable
        onPress={() => setOpen(true)}
        className={cn(
          'flex-row items-center justify-center rounded-lg border-2',
          'border-border bg-surface px-3 dark:border-border-dark dark:bg-surface-dark',
          compact ? 'h-[40px]' : 'h-[56px]',
        )}
      >
        <Text
          className={cn(
            'font-mono-bold text-ink dark:text-ink-dark',
            compact ? 'text-lead' : 'text-heading',
          )}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatDuration(value)}
        </Text>
      </Pressable>

      <DurationSheet
        visible={open}
        value={value}
        onChange={onChange}
        onClose={() => {
          setOpen(false);
          onDone?.();
        }}
      />
    </View>
  );
}

function DurationSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: number;
  onChange: (seconds: number) => void;
  onClose: () => void;
}) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return (
    <Sheet visible={visible} title="Durée" description={formatDuration(value)} onClose={onClose}>
      <View className="flex-row items-center justify-center gap-2 pb-2">
        <Wheel count={60} unit="min" value={minutes} onChange={(m) => onChange(m * 60 + seconds)} />
        <Text className="font-mono-bold text-heading text-muted dark:text-muted-dark">:</Text>
        <Wheel count={60} unit="s" value={seconds} onChange={(s) => onChange(minutes * 60 + s)} />
      </View>
    </Sheet>
  );
}

/**
 * Une colonne de nombres qui s'arrête sur un cran.
 *
 * L'aimantation vient de `snapToInterval` : le défilement s'arrête toujours
 * PILE sur une valeur, jamais entre deux. La valeur retenue se déduit alors
 * de la position, ce qui évite d'avoir à deviner sur quoi l'oeil s'est posé.
 */
function Wheel({
  count,
  unit,
  value,
  onChange,
}: {
  count: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const list = useRef<ScrollView>(null);

  // La position de départ, posée sans animation : la roulette doit s'ouvrir
  // DÉJÀ sur la valeur courante, pas défiler jusqu'à elle sous les yeux.
  useEffect(() => {
    const timer = setTimeout(
      () => list.current?.scrollTo({ y: value * ITEM, animated: false }),
      0,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const landed = Math.round(event.nativeEvent.contentOffset.y / ITEM);
    const next = Math.min(Math.max(landed, 0), count - 1);
    if (next !== value) onChange(next);
  };

  return (
    <View className="items-center gap-1">
      <View style={{ height: ITEM * VISIBLE }} className="w-[76px] justify-center">
        {/* Le cran retenu, désigné par un aplat derrière la colonne : c'est
            lui qui dit où regarder, sans rien ajouter à ce qui défile. */}
        <View
          pointerEvents="none"
          style={{ height: ITEM }}
          className="absolute inset-x-0 rounded-lg bg-primary-soft dark:bg-primary-soft-dark"
        />

        <ScrollView
          ref={list}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM}
          decelerationRate="fast"
          // Une hauteur de cran en haut et en bas : le premier et le dernier
          // nombre peuvent alors se placer au centre comme les autres.
          contentContainerStyle={{ paddingVertical: ITEM }}
          onMomentumScrollEnd={settle}
          // Un glissement lent s'arrête sans élan : sans cela, la valeur ne
          // suivrait pas.
          onScrollEndDrag={settle}
        >
          {Array.from({ length: count }, (_, n) => (
            <View key={n} style={{ height: ITEM }} className="items-center justify-center">
              <Text
                className={cn(
                  'font-mono-bold',
                  n === value
                    ? 'text-heading text-ink dark:text-ink-dark'
                    : 'text-lead text-planned dark:text-planned-dark',
                )}
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {n}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <Text className="text-caption text-muted dark:text-muted-dark">{unit}</Text>
    </View>
  );
}
