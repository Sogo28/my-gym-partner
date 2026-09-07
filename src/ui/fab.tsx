import { Ionicons } from '@expo/vector-icons';
import { Pressable, type PressableProps } from 'react-native';
import { cn } from './cn';

/**
 * L'action d'ajout, en pastille flottante au-dessus de la liste.
 *
 * Un bouton pleine largeur ancré en bas dit « voici LA chose à faire ici ».
 * Sur un catalogue, c'est faux : on vient surtout consulter, et en créer un
 * de temps en temps. La pastille garde le geste à portée de pouce sans
 * prétendre être la raison de la page -- et rend à la liste la ligne qu'il
 * occupait.
 */
export function Fab({
  icon = 'add',
  className,
  ...props
}: PressableProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
}) {
  return (
    <Pressable
      // La liste défile DESSOUS : son rembourrage bas lui laisse la place de
      // finir sans être recouverte.
      className={cn(
        'absolute bottom-6 right-5 h-16 w-16 items-center justify-center rounded-xl bg-primary active:bg-primary-pressed',
        className,
      )}
      // L'ombre ne s'exprime pas en classes : deux plateformes, deux modèles.
      style={{
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
      {...props}
    >
      <Ionicons name={icon} size={30} color="#14160F" />
    </Pressable>
  );
}
