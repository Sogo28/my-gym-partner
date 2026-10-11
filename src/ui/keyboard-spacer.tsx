import { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

/**
 * La hauteur du clavier quand il est ouvert, 0 sinon.
 *
 * Android affiche l'app bord à bord : la fenêtre ne rétrécit plus quand le
 * clavier monte, il se pose PAR-DESSUS la fin des listes. Les résultats
 * d'une recherche s'y cachaient, sans qu'on puisse défiler jusqu'à eux.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

/**
 * Posé à la fin d'une liste qui défile : de quoi amener son dernier élément
 * AU-DESSUS du clavier plutôt que dessous.
 */
export function KeyboardSpacer() {
  const height = useKeyboardHeight();
  return height > 0 ? <View style={{ height }} /> : null;
}
