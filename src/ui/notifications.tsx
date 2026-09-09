import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from './cn';

/**
 * Les messages de l'application, en un seul endroit.
 *
 * Deux formes, et le partage entre elles tient à UNE question : l'utilisateur
 * a-t-il quelque chose à décider ?
 *
 * - Non : un TOAST. Il passe seul, ne demande rien, et n'occupe pas la place
 *   d'un écran. C'est la forme des refus métier et des confirmations.
 * - Oui : un DIALOGUE. Il attend, parce que la suite dépend de la réponse.
 *
 * Auparavant chaque écran gardait son propre message en état et l'affichait
 * dans son flux. Quatorze écrans, quatorze copies -- et un message qui
 * survivait à sa cause, puisque rien ne le faisait expirer.
 */

export type Tone = 'info' | 'success' | 'danger';

export type DialogAction = {
  label: string;
  /** Absent : l'action ne fait que refermer le dialogue. */
  onPress?: () => void;
  tone?: 'primary' | 'default' | 'danger';
};

export type DialogRequest = {
  title: string;
  description?: string;
  actions: DialogAction[];
};

type Toast = { id: number; message: string; tone: Tone };

type Notifications = {
  /** Un message à lire, qui s'efface tout seul. */
  notify: (message: string, tone?: Tone) => void;
  /** Un message qui attend une décision. */
  ask: (request: DialogRequest) => void;
};

const NotificationContext = createContext<Notifications | null>(null);

/**
 * La liste courante, servie à part.
 *
 * Deux contextes et non un seul : `notify` et `ask` ne changent JAMAIS, alors
 * que la liste change à chaque message. Les réunir ferait re-rendre les
 * quatorze écrans à chaque toast, alors qu'aucun ne l'affiche.
 */
const ToastListContext = createContext<{
  toasts: readonly Toast[];
  dismiss: (id: number) => void;
}>({ toasts: [], dismiss: () => {} });

function useToastList() {
  return useContext(ToastListContext);
}

/** Le temps de lire, sans plus : un message qui s'attarde devient du décor. */
const LIFETIME = 4000;

export function useNotifications(): Notifications {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications doit être utilisé sous NotificationProvider.');
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Tone = 'danger') => {
      const id = nextId.current++;
      // Les plus récents en haut, et jamais plus de trois : au-delà, on ne
      // lit plus rien et les premiers partent avant d'avoir été vus.
      setToasts((current) => [{ id, message, tone }, ...current].slice(0, 3));
      setTimeout(() => dismiss(id), LIFETIME);
    },
    [dismiss],
  );

  const ask = useCallback((request: DialogRequest) => setDialog(request), []);

  const value = useMemo(() => ({ notify, ask }), [notify, ask]);
  const list = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss]);

  return (
    <NotificationContext.Provider value={value}>
      <ToastListContext.Provider value={list}>
        {children}

        <ToastHost />

        <Dialog request={dialog} onClose={() => setDialog(null)} />
      </ToastListContext.Provider>
    </NotificationContext.Provider>
  );
}

/**
 * La SURFACE d'affichage des toasts. L'état, lui, reste unique.
 *
 * Un Modal est une fenêtre native posée par-dessus l'application : ce qui est
 * dessiné dans l'application passe DERRIÈRE lui. Un message levé pendant
 * qu'une feuille est ouverte serait donc invisible.
 *
 * D'où cette séparation : la liste vit dans le fournisseur, et chaque fenêtre
 * qui peut rester ouverte pendant une action monte sa propre surface -- en
 * DERNIER dans son contenu, pour être dessinée au-dessus. Toute nouvelle
 * fenêtre modale doit en faire autant.
 */
export function ToastHost() {
  const { toasts, dismiss } = useToastList();

  return (
    // Par-dessus les écrans, hors de la main : en haut, là où rien n'agit,
    // plutôt qu'en bas où vivent les boutons et la barre d'onglets.
    <SafeAreaView
      edges={['top']}
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 z-50 px-4"
    >
      {toasts.map((toast) => (
        <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </SafeAreaView>
  );
}

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  danger: 'alert-circle-outline',
};

const ICON_COLORS: Record<Tone, string> = {
  info: '#46600F',
  success: '#1B7A45',
  danger: '#B3261E',
};

/** Un message qui apparaît, se lit, et s'en va -- ou part d'un tap. */
function ToastView({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(-8)).current;

  // Une seule entrée, au montage : la sortie appartient au parent, qui
  // retire la ligne de la liste.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [opacity, offset]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: offset }] }} className="mb-2">
      <Pressable
        onPress={onDismiss}
        className={cn(
          'flex-row items-center gap-3 rounded-xl border border-border bg-surface p-3.5',
          'dark:border-border-dark dark:bg-surface-dark',
        )}
        style={{
          // L'ombre porte le message au-dessus de l'écran : sans elle, il
          // se confond avec une carte de la page.
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Ionicons name={ICONS[toast.tone]} size={20} color={ICON_COLORS[toast.tone]} />
        <Text className="shrink font-medium text-body text-ink dark:text-ink-dark">
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Un dialogue : il attend une réponse, donc il occupe le centre et il faut le
 * traverser. C'est ce qui le distingue de la feuille d'actions, qui remonte
 * du bas pour proposer sans interrompre.
 */
function Dialog({ request, onClose }: { request: DialogRequest | null; onClose: () => void }) {
  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full gap-2 rounded-2xl bg-surface p-5 dark:bg-surface-dark">
          <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
            {request?.title}
          </Text>
          {request?.description && (
            <Text className="text-body text-muted dark:text-muted-dark">
              {request.description}
            </Text>
          )}

          <View className="mt-2 gap-2">
            {request?.actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  // Refermer D'ABORD : l'action peut ouvrir un écran, et le
                  // dialogue ne doit pas rester derrière lui.
                  onClose();
                  action.onPress?.();
                }}
                className={cn(
                  'min-h-touch items-center justify-center rounded-lg border px-4 py-3',
                  action.tone === 'primary'
                    ? 'border-primary bg-primary'
                    : action.tone === 'danger'
                      ? 'border-[#EAB9B5] bg-[#FDF1F0] dark:border-[#5C332B] dark:bg-[#2A1A16]'
                      : 'border-border bg-surface dark:border-border-dark dark:bg-surface-dark',
                )}
              >
                <Text
                  className={cn(
                    'font-bold text-strong',
                    action.tone === 'primary'
                      ? 'text-ink'
                      : action.tone === 'danger'
                        ? 'text-danger dark:text-danger-dark'
                        : 'text-ink dark:text-ink-dark',
                  )}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
