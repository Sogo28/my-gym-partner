import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, useColorScheme, View, type ViewStyle } from 'react-native';
import { cn } from './cn';
import { VideoBadge } from './set-video';
import { Pop } from './pop';

export type SetRowStatus = 'completed' | 'abandoned' | 'planned' | 'in-progress';

/**
 * La hauteur d'une ligne et l'écart entre deux.
 *
 * Exportés parce qu'une liste qui veut n'en montrer que quatre -- l'écran de
 * séance, où l'anneau et les boutons réclament le reste de la place -- a
 * besoin de les connaître pour se donner sa borne. Une hauteur en pourcentage
 * coupait une cinquième ligne au hasard, différemment sur chaque téléphone.
 *
 * Serrés le 2026-09-27 (52 et 8 auparavant) : quatre lignes dépliées prenaient
 * assez de place pour que l'anneau d'un EMOM doive rétrécir sous elles. La
 * pastille fait vingt-huit pixels, donc quarante-quatre en laissent huit de
 * part et d'autre -- la ligne reste une cible qu'on vise sans regarder, et la
 * valeur garde sa taille de lecture : c'est elle qu'on vient chercher.
 */
export const SET_ROW_HEIGHT = 44;
export const SET_ROW_GAP = 6;

/**
 * La couleur du contour et de la pastille, par état et par thème.
 *
 * Elle ne peut pas venir de la feuille de styles : le contour est posé en
 * style direct (voir plus bas), et l'icône reçoit sa couleur en propriété.
 */
const ACCENTS: Record<'light' | 'dark', Record<SetRowStatus, string>> = {
  light: {
    completed: '#1B7A45',
    abandoned: '#B3261E',
    planned: '#A8AD9E',
    'in-progress': '#14160F',
  },
  dark: {
    completed: '#4FD68A',
    abandoned: '#FF7A66',
    planned: '#8B9086',
    'in-progress': '#F2F4EF',
  },
};

/** Ce que la ligne annonce à sa droite. Terminée, elle n'annonce rien. */
const LABELS: Record<SetRowStatus, string | null> = {
  completed: null,
  abandoned: 'abandonnée',
  planned: 'prévu',
  'in-progress': 'en cours',
};

/**
 * Chaque état déclare les MÊMES propriétés, y compris le côté gauche et le
 * style de trait.
 *
 * Android ne réinitialise pas toujours une propriété de bordure par côté
 * quand le nouveau style ne la mentionne pas : une ligne passant de "prévue"
 * (trait pointillé) à "en cours" gardait son pointillé jusqu'au prochain
 * remontage.
 */
function outlineOf(status: SetRowStatus, accent: string): ViewStyle {
  return {
    borderWidth: 2,
    borderColor: accent,
    borderLeftWidth: 2,
    borderLeftColor: accent,
    borderStyle: status === 'planned' ? 'dashed' : 'solid',
  };
}

type SetRowProps = {
  index: number;
  status: SetRowStatus;
  /** Déjà formaté : "8 reps · 20 kg". */
  values: string;
  /** Rend la ligne tapable, pour ouvrir l'ajustement de cette série. */
  onPress?: () => void;
  selected?: boolean;
  /** Fourni : la série a été filmée, et la pastille ouvre sa vidéo. */
  onPlay?: () => void;
};

/**
 * Une ligne de série. Quatre états, distingués par la pastille, le contour et
 * l'étiquette -- jamais par la seule luminance du texte, qui tomberait sous
 * le seuil de contraste lisible en salle.
 */
export function SetRow({
  index,
  status,
  values,
  onPress,
  selected = false,
  onPlay,
}: SetRowProps) {
  const accents = ACCENTS[useColorScheme() === 'dark' ? 'dark' : 'light'];
  // Ouvrir une série à l'ajustement, c'est y revenir : elle se montre comme
  // celle qu'on est en train de faire.
  const outline = accents[selected ? 'in-progress' : status];

  // Une ligne tapable est un Pressable, sinon une simple vue : pas de zone
  // interactive là où il n'y a rien à ouvrir.
  const Row = onPress ? Pressable : View;

  return (
    // La ligne rebondit à la validation : le geste qui compte le plus se
    // voit, en plus de se sentir.
    //
    // Le rebond l'ENVELOPPE, il n'est pas dedans : une série en cours n'est
    // pas tapable et devient une vue tapable une fois validée -- deux
    // composants différents, donc tout ce qu'elle contient renaît à la
    // validation. Une animation logée à l'intérieur naissait déjà « validée »
    // et n'avait plus de changement à montrer.
    <Pop active={status === 'completed'} from={0.92}>
      <Row
        onPress={onPress}
        className={cn(
          'min-h-[44px] flex-row items-center gap-3 rounded-xl px-4',
          status === 'completed' && 'bg-surface dark:bg-surface-dark',
          status === 'abandoned' && 'bg-surface-alt dark:bg-surface-alt-dark',
          status === 'in-progress' && 'bg-surface dark:bg-surface-dark',
          selected && 'bg-primary-soft dark:bg-primary-soft-dark',
        )}
        // La bordure passe en style direct : appliquée par la feuille de styles,
        // elle pouvait manquer au premier tracé d'une ligne qui vient
        // d'apparaître, et ne revenir qu'au remontage de la liste.
        style={outlineOf(selected ? 'in-progress' : status, outline)}
      >
        <Badge index={index} status={status} accent={accents[status]} />

        <Text
          className={cn(
            'flex-1 font-mono-bold text-heading',
            status === 'completed' && 'text-ink dark:text-ink-dark',
            status === 'planned' && 'text-planned dark:text-planned-dark',
            status === 'abandoned' && 'text-muted line-through dark:text-muted-dark',
            status === 'in-progress' && 'text-primary-ink dark:text-primary-ink-dark',
          )}
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {values}
        </Text>

        {onPlay && <VideoBadge onPress={onPlay} />}

        {/* shrink-0 : cette mention ne doit jamais rogner la valeur. */}
        {LABELS[status] && (
          <Text
            className="shrink-0 font-bold uppercase text-label"
            style={{ color: accents[status] }}
          >
            {LABELS[status]}
          </Text>
        )}
      </Row>
    </Pop>
  );
}

/**
 * La pastille porte le NUMÉRO de la série tant qu'elle est en cours, et sa
 * marque de clôture ensuite : une fois la série finie, ce qui compte est de
 * savoir si elle a été faite, pas son rang -- que la liste donne déjà.
 */
function Badge({
  index,
  status,
  accent,
}: {
  index: number;
  status: SetRowStatus;
  accent: string;
}) {
  return (
    <View
      className="h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{
        borderWidth: 2,
        borderColor: accent,
        borderStyle: status === 'planned' ? 'dashed' : 'solid',
      }}
    >
      {status === 'completed' && <Ionicons name="checkmark" size={15} color={accent} />}
      {status === 'abandoned' && <Ionicons name="close" size={14} color={accent} />}
      {status === 'in-progress' && (
        <Text
          className="font-mono text-small"
          style={{ color: accent, fontVariant: ['tabular-nums'] }}
        >
          {index}
        </Text>
      )}
    </View>
  );
}
