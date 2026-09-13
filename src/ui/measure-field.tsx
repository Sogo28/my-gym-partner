import { DurationField } from './duration-field';
import { isDuration } from './format';
import { NumberField } from './number-field';

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
  label,
  step,
  compact = false,
  onDone,
}: {
  value: number;
  onChange: (value: number) => void;
  unit: string;
  label?: string;
  /** Le pas d'un compteur. Sans objet pour une durée, qui n'en a pas. */
  step?: number;
  compact?: boolean;
  /**
   * Le réglage est terminé. N'a de sens que pour une durée : elle se choisit
   * d'un geste et se referme, là où un compteur n'a pas de fin.
   */
  onDone?: () => void;
}) {
  if (isDuration(unit)) {
    return (
      <DurationField
        value={value}
        onChange={onChange}
        label={label}
        compact={compact}
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
      compact={compact}
    />
  );
}
