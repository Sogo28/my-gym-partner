import { View } from 'react-native';

/**
 * Où l'on en est : un segment par étape -- les exercices d'une séance, les
 * étapes d'un objectif.
 *
 * Les étapes passées sont pleines, celle en cours se remplit, les suivantes
 * attendent. Ce qui est rempli est FAIT : le vert des choses faites, celui du
 * filet d'une séance faite et d'une série validée. Un texte peut dire la même chose en chiffres ; la barre la dit
 * d'un coup d'oeil, de loin.
 */
export type SessionProgress = {
  /** Le nombre d'étapes. Une seule : la barre est continue. */
  readonly segments: number;
  /** La place de l'étape en cours, à partir de zéro. */
  readonly current: number;
  /** La part déjà faite de l'étape en cours, entre 0 et 1. */
  readonly fraction: number;
};

export function ProgressBar({ segments, current, fraction }: SessionProgress) {
  return (
    <View className="flex-row gap-1" accessibilityLabel={`Exercice ${current + 1} sur ${segments}`}>
      {Array.from({ length: segments }, (_, index) => {
        const filled = index < current ? 1 : index === current ? Math.min(1, Math.max(0, fraction)) : 0;
        return (
          <View
            key={index}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-border dark:bg-border-dark"
          >
            <View
              className="h-full rounded-full bg-success dark:bg-success-dark"
              style={{ width: `${filled * 100}%` }}
            />
          </View>
        );
      })}
    </View>
  );
}
