import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
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
 * L'animation utilise l'API Animated intégrée à React Native, et non
 * Reanimated : ce dernier embarque du code natif qui doit correspondre trait
 * pour trait à celui d'Expo Go, ce qui casse dès que les versions divergent.
 * LayoutAnimation, de son côté, n'a plus d'effet avec la New Architecture.
 *
 * On anime l'opacité et un léger glissement plutôt que la hauteur, qu'il
 * faudrait mesurer avant de pouvoir l'interpoler.
 */
export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const progress = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 160,
      // useNativeDriver : l'animation tourne côté natif, sans repasser par le
      // fil JavaScript à chaque image. Possible ici car opacité et translation
      // font partie des propriétés qu'il sait traiter.
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  return (
    <View className={cn('overflow-hidden rounded-2xl border border-border', className)}>
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
          className="gap-1 px-4 pb-4"
          style={{
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          }}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
}
