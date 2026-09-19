import { DurationField } from './duration-field';
import { isDuration } from './format';
import { NumberField } from './number-field';
import { ceilingOf, stepOf } from './set-defaults';

/**
 * La saisie d'une mesure, quelle qu'elle soit.
 *
 * Toutes ne se règlent pas pareil : un décompte s'ajuste d'un cran -- une
 * répétition, deux kilos et demi --, alors qu'une durée s'étend de cinq
 * secondes à cinq minutes et se choisit d'un geste. Les écrans n'ont pas à
 * savoir laquelle ils affichent : ils passent l'unité, et le bon contrôle
 * apparaît.
 */
export function MeasureField({
  value,
  onChange,
  unit,
  measurementId,
  label,
  compact = false,
  autoOpen = false,
  onDone,
}: {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  /**
   * Ce qui est mesuré. Le pas et le plafond en découlent : ce sont des
   * propriétés de la MESURE, pas de l'écran qui l'affiche -- où ils étaient
   * recopiés trois fois.
   */
  measurementId: string;
  label?: string;
  compact?: boolean;
  /**
   * Le réglage est terminé : la roulette vient de se refermer. Vaut pour une
   * durée comme pour un compteur -- les deux se choisissent d'un geste dans
   * une fenêtre qui, en se fermant, dit que la série est réglée.
   */
  onDone?: () => void;
  /** Sans objet pour un compteur, qui n'a pas de fenêtre à ouvrir. */
  autoOpen?: boolean;
}) {
  const step = stepOf(measurementId);

  if (isDuration(unit)) {
    return (
      <DurationField
        value={value}
        onChange={onChange}
        label={label}
        compact={compact}
        step={step}
        autoOpen={autoOpen}
        onDone={onDone}
      />
    );
  }
  return (
    <NumberField
      value={value}
      onChange={onChange}
      unit={unit}
      label={label}
      step={step}
      ceiling={ceilingOf(measurementId)}
      compact={compact}
      onDone={onDone}
    />
  );
}
