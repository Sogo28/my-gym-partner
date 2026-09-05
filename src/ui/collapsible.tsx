import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { cn } from './cn';

type CollapsibleProps = {
  title: ReactNode;
  /** Affiché à droite du titre, visible même replié : un résumé. */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Un bloc dépliable.
 *
 * L'animation passe par Reanimated et non par LayoutAnimation : cette
 * dernière n'a plus d'effet avec la New Architecture, activée par défaut
 * depuis Expo 54. `layout` anime le changement de hauteur du conteneur,
 * `entering`/`exiting` le contenu qui apparaît et disparaît.
 */
export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      className={cn('overflow-hidden rounded-2xl border border-border', className)}
    >
      <Pressable
        onPress={() => setOpen((value) => !value)}
        className="flex-row items-center justify-between gap-3 p-4 active:bg-muted"
      >
        <View className="shrink">
          {typeof title === 'string' ? (
            <Text className="text-base font-semibold">{title}</Text>
          ) : (
            title
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {typeof summary === 'string' ? (
            <Text className="text-muted-foreground">{summary}</Text>
          ) : (
            summary
          )}
          <Text className="text-muted-foreground">{open ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>

      {open && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          className="gap-1 px-4 pb-4"
        >
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}
