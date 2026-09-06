import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, useColorScheme, View } from 'react-native';
import { Button } from './button';
import { cn } from './cn';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Les cases d'un mois, semaine commençant le lundi.
 *
 * getDay() rend 0 pour dimanche : le décalage remet lundi en tête. Les cases
 * nulles comblent le début du mois.
 */
function monthCells(year: number, month: number): (number | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  // Le jour 0 du mois suivant est le dernier du mois courant.
  const days = new Date(year, month + 1, 0).getDate();

  return [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

type DatePickerSheetProps = {
  visible: boolean;
  title: string;
  /** La date proposée à l'ouverture. */
  initial?: Date;
  confirmLabel?: string;
  onConfirm: (date: Date) => void;
  onClose: () => void;
};

/**
 * Sélecteur de date et d'heure, dessiné avec nos composants.
 *
 * Volontairement pas le sélecteur natif : celui-ci impose son apparence, son
 * vocabulaire, et sa fermeture plante au démontage sur Android.
 */
export function DatePickerSheet({
  visible,
  title,
  initial,
  confirmLabel = 'Confirmer',
  onConfirm,
  onClose,
}: DatePickerSheetProps) {
  const [selected, setSelected] = useState(() => initial ?? new Date());
  const [shown, setShown] = useState(() => initial ?? new Date());
  const dark = useColorScheme() === 'dark';
  const muted = dark ? '#8B9086' : '#5F6459';

  // Repartir de la date proposée à chaque ouverture, pas de celle laissée
  // par la fois précédente.
  useEffect(() => {
    if (!visible) return;
    setSelected(initial ?? new Date());
    setShown(initial ?? new Date());
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const year = shown.getFullYear();
  const month = shown.getMonth();
  const today = new Date();

  function pickDay(day: number) {
    const next = new Date(selected);
    next.setFullYear(year, month, day);
    setSelected(next);
  }

  function shiftMonth(by: number) {
    setShown(new Date(year, month + by, 1));
  }

  function shiftTime(field: 'hours' | 'minutes', by: number) {
    const next = new Date(selected);
    if (field === 'hours') next.setHours((next.getHours() + by + 24) % 24);
    else next.setMinutes((next.getMinutes() + by + 60) % 60);
    setSelected(next);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      <View className="gap-4 rounded-t-3xl border-t border-border bg-background p-5 pb-8 dark:border-border-dark dark:bg-background-dark">
        <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">{title}</Text>

        {/* Navigation entre les mois */}
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => shiftMonth(-1)}
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
          >
            <Ionicons name="chevron-back" size={20} color={muted} />
          </Pressable>

          <Text className="font-bold text-[17px] text-ink dark:text-ink-dark">
            {MONTHS[month]} {year}
          </Text>

          <Pressable
            onPress={() => shiftMonth(1)}
            hitSlop={10}
            className="h-11 w-11 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark"
          >
            <Ionicons name="chevron-forward" size={20} color={muted} />
          </Pressable>
        </View>

        <View>
          <View className="flex-row">
            {WEEKDAYS.map((day, index) => (
              <Text
                key={index}
                style={{ width: `${100 / 7}%` }}
                className="pb-1 text-center font-mono text-[11px] text-muted dark:text-muted-dark"
              >
                {day}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {monthCells(year, month).map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={{ width: `${100 / 7}%` }} />;
              }

              const date = new Date(year, month, day);
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);

              return (
                <View key={day} style={{ width: `${100 / 7}%` }} className="p-0.5">
                  <Pressable
                    onPress={() => pickDay(day)}
                    className={cn(
                      'h-11 items-center justify-center rounded-lg',
                      isSelected && 'bg-primary',
                      !isSelected && isToday && 'bg-surface-alt dark:bg-surface-alt-dark',
                    )}
                  >
                    <Text
                      className={cn(
                        'font-mono text-[15px]',
                        isSelected && 'font-mono-bold text-ink',
                        !isSelected && 'text-ink dark:text-ink-dark',
                      )}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* L'heure, réglée par pas comme les valeurs de séries. */}
        <View className="flex-row items-center justify-center gap-4 rounded-xl bg-surface-alt p-3 dark:bg-surface-alt-dark">
          <TimeUnit
            value={selected.getHours()}
            onChange={(by) => shiftTime('hours', by)}
            color={muted}
          />
          <Text className="font-mono-bold text-[26px] text-ink dark:text-ink-dark">:</Text>
          <TimeUnit
            value={selected.getMinutes()}
            step={15}
            onChange={(by) => shiftTime('minutes', by)}
            color={muted}
          />
        </View>

        <Button label={confirmLabel} size="lg" onPress={() => onConfirm(selected)} />
        <Pressable onPress={onClose} className="min-h-touch items-center justify-center">
          <Text className="font-bold text-muted dark:text-muted-dark">Annuler</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function TimeUnit({
  value,
  step = 1,
  onChange,
  color,
}: {
  value: number;
  step?: number;
  onChange: (by: number) => void;
  color: string;
}) {
  return (
    <View className="items-center gap-1">
      <Pressable onPress={() => onChange(step)} hitSlop={8} className="px-3">
        <Ionicons name="chevron-up" size={18} color={color} />
      </Pressable>

      <Text
        className="font-mono-bold text-[26px] text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {String(value).padStart(2, '0')}
      </Text>

      <Pressable onPress={() => onChange(-step)} hitSlop={8} className="px-3">
        <Ionicons name="chevron-down" size={18} color={color} />
      </Pressable>
    </View>
  );
}
