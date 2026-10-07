import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from './cn';
import { usePalette } from './palette';

/**
 * Le gabarit d'une FICHE ou d'un FORMULAIRE : la page d'une chose qu'on
 * consulte ou qu'on écrit -- un objectif, un exercice, un entraînement.
 *
 * Un en-tête au titre centré, puis un espace fixe avant le contenu. Le centre
 * dit « c'est de ceci qu'il s'agit » ; l'espace sépare le nom de la chose de
 * ce qu'on en dit.
 *
 * Trois pièces qu'on assemble plutôt qu'un bloc qui décide de tout :
 *
 *     <DetailLayout title=… onBack=…>
 *       <DetailContent>…ce qui défile…</DetailContent>
 *       <DetailFooter>…le bouton ancré en bas…</DetailFooter>
 *       <Sheet … />
 *     </DetailLayout>
 *
 * Une page qui défile autrement -- une liste qu'on réordonne au doigt -- pose
 * la sienne à la place de `DetailContent` ; les panneaux, eux, restent hors
 * de ce qui défile.
 */
export function DetailLayout({
  title,
  subtitle,
  onBack,
  onMenu,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onMenu?: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pb-6 pt-4">
        <CenteredHeader title={title} subtitle={subtitle} onBack={onBack} onMenu={onMenu} />
      </View>
      {children}
    </SafeAreaView>
  );
}

/**
 * Ce qui défile sous l'en-tête. Les marges sont celles du gabarit ; seul
 * l'écart entre les blocs (`className`, `gap-4` par défaut) reste au choix
 * de la page.
 */
export function DetailContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView
      contentContainerClassName={cn('gap-4 px-5 pb-8', className)}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** L'action ancrée en bas, hors du défilement : elle reste sous le pouce. */
export function DetailFooter({ children }: { children: ReactNode }) {
  return <View className="px-5 pt-2">{children}</View>;
}

/**
 * Retour à gauche, menu à droite, titre au MILIEU de l'écran.
 *
 * Sans menu, sa place reste réservée par un vide de même largeur : sinon le
 * titre glisserait vers la droite d'une fiche à l'autre selon qu'elle a un
 * menu ou non.
 */
export function CenteredHeader({
  title,
  subtitle,
  onBack,
  onMenu,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onMenu?: () => void;
}) {
  const { ink } = usePalette();
  // Des icônes seules, sans pastille : la zone de toucher garde sa taille,
  // c'est le fond qui s'en va. Un appui les efface un instant -- seul signe
  // qu'il a pris, faute de fond qui change.
  const button = 'h-12 w-12 shrink-0 items-center justify-center active:opacity-50';

  return (
    <View className="flex-row items-center gap-3">
      <Pressable onPress={onBack} accessibilityLabel="Retour" className={button}>
        <Ionicons name="chevron-back" size={24} color={ink} />
      </Pressable>

      <View className="shrink grow items-center gap-0.5">
        <Text
          className="text-center font-extrabold text-heading text-ink dark:text-ink-dark"
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle && (
          <Text className="text-center font-mono text-small text-muted dark:text-muted-dark">
            {subtitle}
          </Text>
        )}
      </View>

      {onMenu ? (
        <Pressable onPress={onMenu} hitSlop={8} accessibilityLabel="Menu" className={button}>
          <Ionicons name="ellipsis-horizontal" size={22} color={ink} />
        </Pressable>
      ) : (
        <View className="h-12 w-12 shrink-0" />
      )}
    </View>
  );
}
