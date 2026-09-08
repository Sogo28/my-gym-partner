import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View } from 'react-native';

/**
 * Une liste dont on réordonne les éléments au doigt : appui long, puis on
 * glisse.
 *
 * Écrite avec `PanResponder` et l'`Animated` de React Native, comme le bloc
 * dépliable et pour la même raison : Reanimated embarque du code natif qui
 * doit correspondre trait pour trait à celui d'Expo Go, et ne pardonne pas un
 * écart de version.
 *
 * Les hauteurs sont MESURÉES plutôt que supposées : un exercice à une série
 * et un exercice à cinq n'occupent pas la même place, et c'est en cumulant
 * ces hauteurs qu'on sait au-dessus de quelle carte le doigt se trouve.
 */
export function Reorderable<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  onDraggingChange,
  spacing = 0,
}: {
  items: readonly T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, index: number, dragging: boolean) => ReactNode;
  onReorder: (from: number, to: number) => void;
  /** La page doit cesser de défiler pendant qu'on déplace une carte. */
  onDraggingChange?: (dragging: boolean) => void;
  /** L'écart entre deux éléments, en pixels. */
  spacing?: number;
}) {
  const heights = useRef<number[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  /** Sa position pendant le glissement, pour que le rendu suive le doigt. */
  const offset = useRef(new Animated.Value(0)).current;
  /** Le décalage courant, lu hors du rendu : `Animated.Value` ne se lit pas. */
  const travelled = useRef(0);
  const draggedIndex = useRef<number | null>(null);

  function begin(index: number) {
    draggedIndex.current = index;
    travelled.current = 0;
    offset.setValue(0);
    setDragged(index);
    onDraggingChange?.(true);
  }

  function end() {
    const from = draggedIndex.current;
    if (from !== null) {
      const to = targetOf(from, travelled.current, heights.current);
      if (to !== from) onReorder(from, to);
    }
    draggedIndex.current = null;
    travelled.current = 0;
    offset.setValue(0);
    setDragged(null);
    onDraggingChange?.(false);
  }

  const responder = useRef(
    PanResponder.create({
      // On ne prend la main QUE pendant un appui long déjà commencé : sans
      // cela, la page ne défilerait plus.
      onMoveShouldSetPanResponderCapture: () => draggedIndex.current !== null,
      onPanResponderMove: (_, gesture) => {
        travelled.current = gesture.dy;
        offset.setValue(gesture.dy);
      },
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    }),
  ).current;

  return (
    <View {...responder.panHandlers}>
      {items.map((item, index) => {
        const isDragged = dragged === index;

        return (
          <View
            key={keyOf(item, index)}
            style={{ marginBottom: index === items.length - 1 ? 0 : spacing }}
            onLayout={(event) => {
              // La hauteur mesurée inclut l'écart : c'est bien de place
              // occupée qu'il s'agit quand on cherche où la carte atterrit.
              heights.current[index] = event.nativeEvent.layout.height + spacing;
            }}
          >
            <Animated.View
              style={
                isDragged
                  ? {
                      transform: [{ translateY: offset }],
                      // Elle passe au-dessus des autres, et le dit.
                      zIndex: 10,
                      elevation: 8,
                      opacity: 0.95,
                    }
                  : undefined
              }
            >
              <LongPressable onHold={() => begin(index)} enabled={dragged === null}>
                {renderItem(item, index, isDragged)}
              </LongPressable>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Où la carte déplacée atterrit.
 *
 * On avance dans les cartes voisines tant que le trajet dépasse la moitié de
 * la hauteur de la suivante : c'est le moment où l'oeil considère qu'elle a
 * changé de place.
 */
function targetOf(from: number, travelled: number, heights: readonly number[]): number {
  let index = from;
  let remaining = travelled;

  while (remaining > 0 && index < heights.length - 1) {
    const next = heights[index + 1] ?? 0;
    if (remaining < next / 2) break;
    remaining -= next;
    index += 1;
  }
  while (remaining < 0 && index > 0) {
    const previous = heights[index - 1] ?? 0;
    if (-remaining < previous / 2) break;
    remaining += previous;
    index -= 1;
  }

  return index;
}

/**
 * Un appui long qui n'empêche pas les taps de ses enfants.
 *
 * `Pressable` capturerait le toucher : les champs et les boutons de la carte
 * ne répondraient plus. On écoute donc le toucher sans le prendre, et on ne
 * déclenche qu'à l'expiration du délai.
 */
function LongPressable({
  children,
  onHold,
  enabled,
}: {
  children: ReactNode;
  onHold: () => void;
  enabled: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <View
      onTouchStart={() => {
        if (!enabled) return;
        cancel();
        timer.current = setTimeout(onHold, 350);
      }}
      // Un doigt qui bouge avant le délai voulait faire défiler la page.
      onTouchMove={cancel}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
    >
      {children}
    </View>
  );
}
