import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import { formatDuration } from './format';
import { fieldBox, StepButton, TAPPABLE } from './number-field';
import { Sheet } from './sheet';
import { ladder, Wheel } from './wheel';

/** Zéro à cinquante-neuf : les deux colonnes d'une durée ont les mêmes crans. */
const SIXTY = ladder(1, 59);

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
  step = 1,
  autoOpen = false,
  onDone,
}: {
  /** En secondes : c'est ainsi qu'une durée est mesurée et stockée. */
  value: number;
  onChange: (seconds: number) => void;
  label?: string;
  compact?: boolean;
  /** Le pas des flèches, en secondes. */
  step?: number;
  /**
   * Appelé en refermant la roulette.
   *
   * Pour une durée, la roulette EST tout le réglage : une fois la valeur
   * choisie, il n'y a plus rien à faire sur cette série. L'écran qui la
   * tenait ouverte peut donc la relâcher, au lieu d'attendre un second geste
   * qui ne dirait rien de plus.
   */
  /**
   * Ouvre la roulette dès l'apparition du champ.
   *
   * Pour une série dont la durée est la SEULE mesure, le champ n'a rien à
   * montrer que la roulette ne montre : s'arrêter dessus demanderait un tap
   * pour rien. Le champ reste derrière, et se retrouve en refermant.
   */
  autoOpen?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(autoOpen);

  return (
    <View className="flex-1 gap-1">
      {label && (
        <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
          {label}
        </Text>
      )}

      {/* Le MÊME contrôle que pour les autres mesures : un pas de part et
          d'autre, et la valeur au milieu qui ouvre de quoi la choisir. Une
          durée n'est pas un cas à part : à côté d'un compteur de répétitions,
          un simple cadre se serait donné pour autre chose qu'il n'est.

          Ce qui lui reste en propre : elle se lit en minutes, et sa roulette
          a deux colonnes. */}
      <View className={fieldBox(compact)}>
        <StepButton
          icon="remove"
          compact={compact}
          onPress={() => onChange(Math.max(0, value - step))}
        />

        <Pressable onPress={() => setOpen(true)} className={cn('shrink items-center', TAPPABLE)}>
          <Text
            className={cn(
              'font-mono-bold text-ink dark:text-ink-dark',
              compact ? 'text-lead' : 'text-heading',
            )}
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {formatDuration(value)}
          </Text>
        </Pressable>

        <StepButton icon="add" compact={compact} onPress={() => onChange(value + step)} />
      </View>

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
        <Wheel values={SIXTY} unit="min" value={minutes} onChange={(m) => onChange(m * 60 + seconds)} />
        <Text className="font-mono-bold text-heading text-muted dark:text-muted-dark">:</Text>
        <Wheel
          values={SIXTY}
          unit="s"
          value={seconds}
          onChange={(s) => onChange(minutes * 60 + s)}
          loop
        />
      </View>
    </Sheet>
  );
}
