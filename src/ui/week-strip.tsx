import { Pressable, Text, View } from 'react-native';
import { cn } from './cn';
import { feelSelection } from './haptics';

/** L'état d'un jour : ce qu'on y a fait, ce qui y est prévu. */
export type WeekDay = {
  readonly date: Date;
  readonly worked: boolean;
  readonly scheduled: boolean;
  readonly today: boolean;
};

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * La semaine en sept carrés.
 *
 * Deux états distincts et pas un seul : un jour TRAVAILLÉ est plein, un jour
 * seulement PRÉVU est contourné. Les confondre ferait ressembler une semaine
 * d'intentions à une semaine d'entraînement.
 *
 * Taper un jour le sélectionne, et le retaper rend la vue à la semaine
 * entière : il n'y a donc rien à apprendre pour en sortir.
 */
export function WeekStrip({
  days,
  selected,
  onSelect,
}: {
  days: readonly WeekDay[];
  /** Le jour affiché seul, ou null pour la semaine entière. */
  selected?: Date | null;
  onSelect?: (day: Date | null) => void;
}) {
  const isSelected = (day: Date) =>
    selected != null && selected.getTime() === day.getTime();

  return (
    <View className="flex-row gap-1.5">
      {days.map((day, index) => (
        <Pressable
          key={index}
          className="flex-1 items-center gap-1"
          disabled={!onSelect}
          onPress={() => {
            feelSelection();
            onSelect?.(isSelected(day.date) ? null : day.date);
          }}
        >
          <Text className="text-micro text-muted dark:text-muted-dark">{LETTERS[index]}</Text>

          <View
            className={cn(
              'h-10 w-full items-center justify-center rounded-lg border-2',
              // Le vert des choses faites : un jour travaillé EST fait.
              day.worked &&
                'border-success bg-success dark:border-success-dark dark:bg-success-dark',
              !day.worked &&
                day.scheduled &&
                'border-primary-ink bg-transparent dark:border-primary-ink-dark',
              !day.worked &&
                !day.scheduled &&
                'border-transparent bg-surface-alt dark:bg-surface-alt-dark',
              // En DERNIER : le contour du jour regardé doit gagner sur celui
              // des trois états au-dessus, que cn résout au dernier écrit.
              // Un contour foncé plutôt qu'une couleur : il distingue sans
              // mentir sur ce qui a été fait ce jour-là.
              isSelected(day.date) && 'border-ink dark:border-ink-dark',
            )}
          >
            <Text
              className={cn(
                'font-mono text-small',
                // Blanc sur le vert foncé du thème clair, encre sur le vert vif du
                // sombre : chacun là où il se lit.
                day.worked ? 'text-white dark:text-ink' : 'text-muted dark:text-muted-dark',
                // Aujourd'hui se lit en gras : c'est le repère depuis lequel
                // on lit tous les autres.
                day.today && 'font-mono-bold',
              )}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {day.date.getDate()}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
