import { useState, type ReactNode } from 'react';
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { cn } from './cn';

// Sur Android, l'animation de mise en page doit être activée explicitement.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsibleProps = {
  title: ReactNode;
  /** Affiché à droite du titre, visible même replié : un résumé. */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

/**
 * Un bloc dépliable. L'animation est confiée à LayoutAnimation : le système
 * interpole lui-même entre les deux mises en page, sans qu'on ait à animer
 * une hauteur qu'on ne connaît pas d'avance.
 */
export function Collapsible({
  title,
  summary,
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((value) => !value);
  }

  return (
    <View className={cn('overflow-hidden rounded-2xl border border-border', className)}>
      <Pressable
        onPress={toggle}
        className="flex-row items-center justify-between gap-3 p-4 active:bg-muted"
      >
        <View className="shrink">{typeof title === 'string' ? <Text className="text-base font-semibold">{title}</Text> : title}</View>
        <View className="flex-row items-center gap-2">
          {typeof summary === 'string' ? (
            <Text className="text-muted-foreground">{summary}</Text>
          ) : (
            summary
          )}
          <Text className="text-muted-foreground">{open ? '⌃' : '⌄'}</Text>
        </View>
      </Pressable>

      {open && <View className="gap-1 px-4 pb-4">{children}</View>}
    </View>
  );
}
