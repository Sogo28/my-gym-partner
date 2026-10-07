import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from './button';
import { cn } from './cn';
import { usePalette } from './palette';
import { SheetFrame } from './sheet-frame';

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
  const { muted } = usePalette();

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
    <SheetFrame visible={visible} onClose={onClose}>
      <View className="gap-4">
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

          <Text className="font-bold text-strong text-ink dark:text-ink-dark">
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
                className="pb-1 text-center font-mono text-caption text-muted dark:text-muted-dark"
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
                      isSelected && 'bg-selected dark:bg-selected-dark',
                      !isSelected && isToday && 'bg-surface-alt dark:bg-surface-alt-dark',
                    )}
                  >
                    <Text
                      className={cn(
                        'font-mono text-lead',
                        isSelected && 'font-mono-bold text-on-selected dark:text-on-selected-dark',
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
          <Text className="font-mono-bold text-title text-ink dark:text-ink-dark">:</Text>
          <TimeUnit
            value={selected.getMinutes()}
            // Une minute par tap : le pas de quinze supposait qu'on ne
            // programme qu'aux quarts d'heure. L'appui long couvre la
            // distance quand elle est longue.
            onChange={(by) => shiftTime('minutes', by)}
            color={muted}
          />
        </View>

        {/* Pas de bouton « Annuler » : le panneau se referme comme tous les
            autres, en tapant le fond ou en tirant sa poignée. */}
        <Button label={confirmLabel} size="lg" onPress={() => onConfirm(selected)} />
      </View>
    </SheetFrame>
  );
}

/**
 * Une unité de temps qui avance d'un pas au tap, et défile à l'appui long.
 *
 * Sans la répétition, un pas fin obligerait à taper cinquante fois pour
 * traverser une heure -- c'est ce qui avait fait choisir un pas de quinze
 * minutes, au prix des horaires qui ne tombent pas sur un quart.
 */
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
  const repeating = useRef<ReturnType<typeof setInterval> | null>(null);

  const hold = (by: number) => () => {
    stop();
    repeating.current = setInterval(() => onChange(by), 80);
  };
  const stop = () => {
    if (repeating.current) clearInterval(repeating.current);
    repeating.current = null;
  };

  return (
    <View className="items-center gap-1">
      <Pressable
        onPress={() => onChange(step)}
        onLongPress={hold(step)}
        onPressOut={stop}
        hitSlop={8}
        className="px-3"
      >
        <Ionicons name="chevron-up" size={18} color={color} />
      </Pressable>

      <Text
        className="font-mono-bold text-title text-ink dark:text-ink-dark"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {String(value).padStart(2, '0')}
      </Text>

      <Pressable
        onPress={() => onChange(-step)}
        onLongPress={hold(-step)}
        onPressOut={stop}
        hitSlop={8}
        className="px-3"
      >
        <Ionicons name="chevron-down" size={18} color={color} />
      </Pressable>
    </View>
  );
}
