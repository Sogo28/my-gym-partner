import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Le module, chargé SANS le supposer présent. Il est natif : une application
 * construite avant lui ne le porte pas, et l'importer d'office ferait planter
 * l'écran de séance dès qu'une mise à jour du code y arrive. Absent, les
 * signaux se taisent, comme sur le web.
 */
let loadProblem: string | null = null;
const Notifications: NotificationsModule | null = (() => {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch (e) {
    loadProblem = `module de notifications absent (${e instanceof Error ? e.message : String(e)})`;
    return null;
  }
})();

/**
 * Les signaux d'une séance quand le téléphone est VERROUILLÉ (décidé le
 * 2026-10-08).
 *
 * Verrouillé, le téléphone suspend l'application : ses minuteurs s'arrêtent,
 * et le décompte avant une série se figeait jusqu'au déverrouillage. Seul le
 * système peut encore vibrer à l'heure dite -- d'où des notifications
 * PROGRAMMÉES d'avance pour cette heure-là : le zéro d'un décompte, chaque
 * tour de repos.
 *
 * Au premier plan, elles se taisent (voir le gestionnaire plus bas) :
 * l'application a déjà ses propres bips et vibrations, et les doubler ferait
 * deux signaux pour une seule chose.
 *
 * Comme le son et la vibration ailleurs, c'est un confort : sans
 * autorisation, ou sur le web, rien ne casse -- rien ne sonne non plus.
 */

/**
 * Vibration seule : ne dérange personne dans la salle.
 *
 * Android ne laisse plus modifier un canal une fois créé : changer son
 * réglage oblige à changer son nom, d'où le numéro.
 */
const VIBRATE = 'signal-vibrate-2';
/**
 * Son et vibration, pour qui l'a choisi pour le repos. Le son du SYSTÈME :
 * on n'en nomme aucun -- `'default'` était pris pour un fichier introuvable.
 */
const SOUND = 'signal-sound-2';

const supported = Notifications !== null;
/** Réussie, la préparation ne se refait pas ; ratée, elle se retente. */
let prepared: Promise<string | null> | null = null;
/** La dernière raison pour laquelle un signal n'a pas pu être programmé. */
let scheduleProblem: string | null = null;

/**
 * Prépare les canaux et demande l'autorisation.
 *
 * Appelé au DÉMARRAGE d'une séance (décidé le 2026-10-08) : la demande
 * arrive au moment où l'on comprend à quoi elle sert, et avant le premier
 * décompte qui en aurait besoin.
 *
 * Rend `null` quand tout est prêt, sinon la raison -- de quoi le dire à
 * l'écran plutôt que de rester muet sans qu'on sache pourquoi.
 */
export function prepareSessionAlerts(): Promise<string | null> {
  // Le web ne sert qu'à regarder les écrans : rien à y signaler.
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (!supported) return Promise.resolve(loadProblem ?? 'notifications indisponibles ici');
  const attempt =
    prepared ??
    (async (): Promise<string | null> => {
    try {
      Notifications!.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      // Les canaux de la première version, mal réglés, ne servent plus.
      await Notifications!.deleteNotificationChannelAsync('signal-vibrate').catch(() => undefined);
      await Notifications!.deleteNotificationChannelAsync('signal-sound').catch(() => undefined);

      await Notifications!.setNotificationChannelAsync(VIBRATE, {
        name: 'Séance : vibration',
        importance: Notifications!.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        enableVibrate: true,
        sound: null,
      });
      await Notifications!.setNotificationChannelAsync(SOUND, {
        name: 'Séance : son et vibration',
        importance: Notifications!.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        enableVibrate: true,
      });

      const current = await Notifications!.getPermissionsAsync();
      if (current.granted) return null;
      if (!current.canAskAgain) {
        return "notifications refusées : autorise-les dans les réglages Android de l'app";
      }
      const asked = await Notifications!.requestPermissionsAsync();
      return asked.granted ? null : 'notifications refusées';
    } catch (e) {
      return `préparation impossible (${e instanceof Error ? e.message : String(e)})`;
    }
  })();
  prepared = attempt;
  attempt.then((problem) => {
    // Un refus ou une erreur se retente au prochain démarrage de séance :
    // on a pu autoriser entre-temps.
    if (problem !== null && prepared === attempt) prepared = null;
  });
  return attempt;
}

/** Pourquoi le dernier signal n'a pas pu être programmé, s'il y a une raison. */
export function sessionAlertsProblem(): string | null {
  return scheduleProblem;
}

/**
 * Programme un signal pour l'instant `at` (en millisecondes), et rend de quoi
 * l'annuler. Un instant déjà passé n'est pas programmé.
 */
export async function scheduleSessionAlert(input: {
  at: number;
  title: string;
  body?: string;
  sound?: boolean;
}): Promise<string | null> {
  if (!supported || input.at <= Date.now()) return null;
  const problem = await prepareSessionAlerts();
  if (problem !== null) {
    scheduleProblem = problem;
    return null;
  }
  try {
    return await Notifications!.scheduleNotificationAsync({
      content: { title: input.title, body: input.body },
      trigger: {
        type: Notifications!.SchedulableTriggerInputTypes.DATE,
        date: input.at,
        channelId: input.sound ? SOUND : VIBRATE,
      },
    });
  } catch (e) {
    scheduleProblem = `programmation impossible (${e instanceof Error ? e.message : String(e)})`;
    return null;
  }
}

/** Retire des signaux programmés qui n'ont plus lieu d'être. */
export function cancelSessionAlerts(ids: readonly (string | null)[]): void {
  if (!supported) return;
  for (const id of ids) {
    if (id) Notifications!.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
}

export type SessionAlert = {
  at: number;
  title: string;
  body?: string;
  sound?: boolean;
};

/**
 * Tient programmés les signaux donnés tant que `key` ne change pas, et les
 * retire quand il change ou que l'écran s'en va : un décompte annulé ou un
 * repos interrompu ne doit pas vibrer dans la poche une minute plus tard.
 */
export function useSessionAlerts(alerts: readonly SessionAlert[], key: string): void {
  const latest = useRef(alerts);
  latest.current = alerts;

  useEffect(() => {
    const wanted = latest.current;
    if (wanted.length === 0) return;
    let ids: (string | null)[] = [];
    let gone = false;
    Promise.all(wanted.map(scheduleSessionAlert)).then((scheduled) => {
      if (gone) cancelSessionAlerts(scheduled);
      else ids = scheduled;
    });
    return () => {
      gone = true;
      cancelSessionAlerts(ids);
    };
  }, [key]);
}
