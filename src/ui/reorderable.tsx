import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View } from 'react-native';

/** Ce qu'il faut poser sur la poignée pour qu'elle prenne le geste. */
export type DragHandle = { readonly handle: object; readonly dragging: boolean };

/**
 * Une liste dont on réordonne les éléments au doigt, par une POIGNÉE.
 *
 * L'appui long sur la carte entière ne peut pas fonctionner ici : elle
 * contient des zones tapables -- l'en-tête dépliable, les champs, le bouton
 * de retrait -- et c'est la plus intérieure d'entre elles qui reçoit le
 * toucher. Le parent n'apprend jamais qu'on appuie. Une poignée dédiée prend
 * le geste dès le contact, sans délai ni ambiguïté avec le défilement.
 *
 * Écrite avec `PanResponder` et l'`Animated` de React Native, comme le bloc
 * dépliable et pour la même raison : Reanimated embarque du code natif qui
 * doit correspondre trait pour trait à celui d'Expo Go.
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
  renderItem: (item: T, index: number, drag: DragHandle) => ReactNode;
  onReorder: (from: number, to: number) => void;
  /** La page doit cesser de défiler pendant qu'on déplace une carte. */
  onDraggingChange?: (dragging: boolean) => void;
  /** L'écart entre deux éléments, en pixels. */
  spacing?: number;
}) {
  const heights = useRef<number[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  /** Où la carte atterrirait si on lâchait maintenant. */
  const [preview, setPreview] = useState<number | null>(null);
  /** Sa position pendant le glissement, pour que le rendu suive le doigt. */
  const offset = useRef(new Animated.Value(0)).current;
  /** Le décalage courant, lu hors du rendu : un `Animated.Value` ne se lit pas. */
  const travelled = useRef(0);
  const from = useRef<number | null>(null);

  function begin(index: number) {
    from.current = index;
    travelled.current = 0;
    offset.setValue(0);
    setDragged(index);
    setPreview(index);
    onDraggingChange?.(true);
  }

  function move(dy: number) {
    travelled.current = dy;
    offset.setValue(dy);

    // L'aperçu ne change qu'en franchissant une carte : recalculer à chaque
    // pixel ne dirait rien de plus, et redessinerait la liste pour rien.
    const start = from.current;
    if (start === null) return;
    const to = targetOf(start, dy, heights.current);
    setPreview((current) => (current === to ? current : to));
  }

  function end() {
    const start = from.current;
    if (start !== null) {
      const to = targetOf(start, travelled.current, heights.current);
      if (to !== start) onReorder(start, to);
    }
    from.current = null;
    travelled.current = 0;
    offset.setValue(0);
    setDragged(null);
    setPreview(null);
    onDraggingChange?.(false);
  }

  return (
    <View>
      {items.map((item, index) => (
        <Row
          key={keyOf(item, index)}
          index={index}
          spacing={index === items.length - 1 ? 0 : spacing}
          dragging={dragged === index}
          // Les autres cartes s'écartent pour montrer la place qui se libère.
          shift={shiftOf(index, dragged, preview, heights.current)}
          offset={offset}
          onBegin={begin}
          onMove={move}
          onEnd={end}
          onHeight={(height) => {
            // La hauteur mesurée inclut l'écart : c'est bien de place occupée
            // qu'il s'agit quand on cherche où la carte atterrit.
            heights.current[index] = height + spacing;
          }}
          render={(drag) => renderItem(item, index, drag)}
        />
      ))}
    </View>
  );
}

/**
 * De combien une carte se décale pour laisser voir le trou.
 *
 * Celles qu'on a dépassées reculent d'exactement la hauteur de la carte
 * déplacée -- ni plus ni moins, sinon la place laissée ne serait pas la
 * sienne.
 */
function shiftOf(
  index: number,
  dragged: number | null,
  preview: number | null,
  heights: readonly number[],
): number {
  if (dragged === null || preview === null || index === dragged) return 0;

  const height = heights[dragged] ?? 0;
  if (preview > dragged && index > dragged && index <= preview) return -height;
  if (preview < dragged && index >= preview && index < dragged) return height;
  return 0;
}

function Row({
  index,
  spacing,
  dragging,
  shift,
  offset,
  onBegin,
  onMove,
  onEnd,
  onHeight,
  render,
}: {
  index: number;
  spacing: number;
  dragging: boolean;
  shift: number;
  offset: Animated.Value;
  onBegin: (index: number) => void;
  onMove: (dy: number) => void;
  onEnd: () => void;
  onHeight: (height: number) => void;
  render: (drag: DragHandle) => ReactNode;
}) {
  /**
   * Ce que le geste doit savoir, tenu à jour SANS recréer le responder.
   *
   * C'est tout le piège : un `PanResponder` recréé au rendu remplace les
   * gestionnaires de la vue, et React Native perd le geste en cours -- la
   * carte revenait donc à sa place au moment même où elle commençait à
   * bouger, puisque commencer à bouger provoque un rendu.
   */
  const latest = useRef({ index, onBegin, onMove, onEnd });
  latest.current = { index, onBegin, onMove, onEnd };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Le défilement ne doit pas pouvoir reprendre le doigt en route.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onBegin(latest.current.index),
      onPanResponderMove: (_, gesture) => latest.current.onMove(gesture.dy),
      onPanResponderRelease: () => latest.current.onEnd(),
      onPanResponderTerminate: () => latest.current.onEnd(),
    }),
  ).current;

  return (
    <View
      style={{ marginBottom: spacing }}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
    >
      <Animated.View
        style={
          dragging
            ? {
                transform: [{ translateY: offset }],
                // Elle passe au-dessus des autres, et le dit.
                zIndex: 10,
                elevation: 8,
                opacity: 0.95,
              }
            : { transform: [{ translateY: shift }] }
        }
      >
        {render({ handle: responder.panHandlers, dragging })}
      </Animated.View>
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
