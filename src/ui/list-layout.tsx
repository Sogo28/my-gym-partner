import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from './cn';
import { CenteredHeader } from './detail-layout';

/**
 * Le gabarit d'une LISTE : l'historique, les objectifs, les mensurations --
 * et les pages qui se parcourent comme elles, le profil, les réglages.
 *
 * Le même en-tête que les fiches, titre centré, puis :
 *
 *     <ListLayout title=… onBack=… toolbar={<SearchField … />}>
 *       <ListContent>…les lignes…</ListContent>
 *       <Fab … />
 *       <Sheet … />
 *     </ListLayout>
 *
 * `toolbar` reste fixe sous l'en-tête -- une recherche, des filtres : on
 * filtre ce qui défile, on ne le fait pas défiler avec. Tout le reste vit
 * dans la zone de la liste, et c'est depuis son bas que la pastille d'ajout
 * se place : la même hauteur sur chaque liste, quelle que soit la barre de
 * gestes du téléphone.
 */
export function ListLayout({
  title,
  subtitle,
  onBack,
  onMenu,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onMenu?: () => void;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background dark:bg-background-dark">
      <View className="px-5 pb-6 pt-4">
        <CenteredHeader title={title} subtitle={subtitle} onBack={onBack} onMenu={onMenu} />
      </View>
      {toolbar && <View className="gap-3 px-5 pb-3">{toolbar}</View>}
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}

/**
 * Ce qui défile. Le bas laisse de quoi finir sous la pastille d'ajout ; une
 * page sans pastille le réduit (`className="pb-8"`).
 */
export function ListContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <ScrollView
      contentContainerClassName={cn('grow gap-3 px-5 pb-28', className)}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
