import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, View } from 'react-native';

/**
 * De quoi faire défiler la page pendant qu'on déplace une carte.
 *
 * La liste ne possède pas la zone qui défile -- la page a d'autres choses
 * autour --, alors elle demande : voici où j'en suis, emmène-moi là.
 */
export type AutoScroll = {
  /** Le défilement courant, en pixels. */
  offsetY: () => number;
  scrollTo: (y: number) => void;
};

/** Les bandes, en haut et en bas de l'écran, où le défilement se déclenche. */
const EDGE = 140;
/** Ce qu'on fait défiler par battement, au plus. */
const SPEED = 22;

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
  autoScroll,
  spacing = 0,
}: {
  items: readonly T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, index: number, drag: DragHandle) => ReactNode;
  onReorder: (from: number, to: number) => void;
  /** La page doit cesser de défiler pendant qu'on déplace une carte. */
  onDraggingChange?: (dragging: boolean) => void;
  autoScroll?: AutoScroll;
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
  /** Le glissement du doigt seul, sans ce que le défilement a ajouté. */
  const fingerY = useRef(0);
  /** Ce que le défilement a fait défiler depuis le début du geste. */
  const scrolled = useRef(0);
  /** Le battement qui fait défiler tant que le doigt reste près d'un bord. */
  const ticking = useRef<ReturnType<typeof setInterval> | null>(null);
  /**
   * La position qu'on a DEMANDÉE, distincte de celle qu'on observe.
   *
   * Les événements de défilement arrivent après coup : demander « position
   * observée + un pas » à chaque battement revenait à redemander sans cesse
   * le même endroit, et la page n'avançait presque pas.
   */
  const requested = useRef(0);
  /** D'où l'on partait, pour savoir de combien la page a bougé depuis. */
  const startedAt = useRef(0);

  function begin(index: number) {
    from.current = index;
    travelled.current = 0;
    fingerY.current = 0;
    scrolled.current = 0;
    startedAt.current = autoScroll?.offsetY() ?? 0;
    offset.setValue(0);
    setDragged(index);
    setPreview(index);
    onDraggingChange?.(true);
  }

  /**
   * Ce que la carte a parcouru : le doigt PLUS ce que la page a défilé.
   *
   * Sans le second terme, la carte resterait collée au contenu et fuirait
   * sous le doigt dès que la page se met à bouger.
   */
  function apply() {
    travelled.current = fingerY.current + scrolled.current;
    offset.setValue(travelled.current);

    const start = from.current;
    if (start === null) return;
    const to = targetOf(start, travelled.current, heights.current);
    setPreview((current) => (current === to ? current : to));
  }

  /**
   * Fait défiler tant que le doigt reste dans une bande de bord.
   *
   * Le décalage réellement obtenu est mesuré, jamais supposé : en bout de
   * course, la page ne défile plus et la carte doit alors s'arrêter avec elle.
   */
  function edgeScroll(screenY: number) {
    if (!autoScroll) return;
    const height = Dimensions.get('window').height;

    const up = screenY < EDGE ? (screenY - EDGE) / EDGE : 0;
    const down = screenY > height - EDGE ? (screenY - (height - EDGE)) / EDGE : 0;
    const direction = up || down;

    if (direction === 0) {
      stopScrolling();
      return;
    }
    if (ticking.current) return;

    requested.current = autoScroll.offsetY();
    let stalled = 0;

    ticking.current = setInterval(() => {
      const reported = autoScroll.offsetY();

      /**
       * La page a-t-elle cessé de bouger ? Bout de course, haut ou bas.
       *
       * On ne continue pas de demander plus loin : la carte se décalerait
       * d'un défilement qui n'a pas lieu.
       */
      if (Math.abs(reported - requested.current) > 120) {
        stalled += 1;
        if (stalled > 2) {
          requested.current = reported;
          return;
        }
      } else {
        stalled = 0;
      }

      requested.current = Math.max(0, requested.current + direction * SPEED);
      autoScroll.scrollTo(requested.current);

      /**
       * La carte se décale de ce QU'ON A DEMANDÉ, pas de ce qu'on observe.
       *
       * C'est le même nombre qui déplace la page : les deux bougent donc
       * exactement ensemble. Se fier aux événements de défilement les ferait
       * avancer sur deux horloges différentes -- l'une régulière, l'autre par
       * à-coups --, et la carte tremblerait de leur écart.
       */
      scrolled.current = requested.current - startedAt.current;
      apply();
    }, 16);
  }

  function stopScrolling() {
    if (ticking.current) clearInterval(ticking.current);
    ticking.current = null;
  }

  // L'aperçu ne change qu'en franchissant une carte : recalculer à chaque
  // pixel ne dirait rien de plus, et redessinerait la liste pour rien.
  function move(dy: number, screenY: number) {
    fingerY.current = dy;
    apply();
    edgeScroll(screenY);
  }

  function end() {
    stopScrolling();
    const start = from.current;
    if (start !== null) {
      const to = targetOf(start, travelled.current, heights.current);
      if (to !== start) onReorder(start, to);
    }
    from.current = null;
    travelled.current = 0;
    fingerY.current = 0;
    scrolled.current = 0;

    setDragged(null);
    setPreview(null);
    onDraggingChange?.(false);
  }

  /**
   * La position de la carte ne revient à zéro qu'une fois le nouvel ordre
   * RENDU.
   *
   * Le déplacement est un état React, peint au rendu suivant ; la position
   * est une valeur animée, appliquée à la vue tout de suite. Remettre la
   * seconde avant que le premier n'arrive faisait revenir la carte à sa place
   * d'origine le temps d'une image, juste avant qu'elle n'apparaisse à la
   * nouvelle. Un effet s'exécute après la mise à jour, pas avant.
   */
  useEffect(() => {
    if (dragged === null) offset.setValue(0);
  }, [dragged, offset]);

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
  onMove: (dy: number, screenY: number) => void;
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
      // pageY est la position du doigt À L'ÉCRAN : c'est elle qui dit qu'on
      // approche d'un bord, ce que dy ne peut pas savoir.
      onPanResponderMove: (event, gesture) =>
        latest.current.onMove(gesture.dy, event.nativeEvent.pageY),
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
