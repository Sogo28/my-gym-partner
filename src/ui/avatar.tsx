import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

/**
 * Le raccourci vers le profil, posé dans l'en-tête de l'accueil.
 *
 * Rond, là où toutes les autres pastilles de l'application sont carrées :
 * c'est la convention qui distingue partout « quelqu'un » de « quelque
 * chose », et elle évite d'écrire « Profil » à côté d'une icône qui le dit
 * déjà.
 *
 * Sans compte, une silhouette. Avec un compte, les initiales : un visage vaut
 * mieux qu'un pictogramme pour signaler QUI est connecté -- ce qui comptera
 * le jour où se tromper de compte deviendra possible.
 */
export function AvatarButton({
  initials,
  onPress,
}: {
  initials?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Profil"
      className="h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-alt dark:bg-surface-alt-dark"
    >
      {initials ? (
        <Text className="font-extrabold text-small text-ink dark:text-ink-dark">{initials}</Text>
      ) : (
        <Ionicons name="person-outline" size={20} color="#8B9086" />
      )}
    </Pressable>
  );
}
