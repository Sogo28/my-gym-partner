import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, View } from 'react-native';
import { cn } from './cn';
import { PALETTE } from './palette';

/**
 * Une case : carrée pour un choix parmi plusieurs qu'on cumule, ronde pour un
 * choix unique -- la convention qui dit, avant de toucher, si cocher l'une
 * décoche l'autre.
 *
 * Cochée, elle prend l'aplat des choix sélectionnés (`selected`), noir ou
 * blanc : retenir une option n'est pas une chose faite, elle n'a pas le vert.
 */
export function Checkbox({ checked, round = false }: { checked: boolean; round?: boolean }) {
  const dark = useColorScheme() === 'dark';

  return (
    <View
      className={cn(
        'h-[22px] w-[22px] items-center justify-center',
        // `sm` et non `md` : l'échelle des rayons met `md` à 12 points, et
        // une case de 22 points arrondie de 12 est un rond.
        round ? 'rounded-full' : 'rounded-sm',
        checked
          ? 'bg-selected dark:bg-selected-dark'
          : 'border-2 border-border-strong dark:border-border-strong-dark',
      )}
    >
      {checked && (
        <Ionicons
          name="checkmark"
          size={15}
          color={dark ? PALETTE.dark.background : PALETTE.light.surface}
        />
      )}
    </View>
  );
}
