import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../src/ui/button";
import { messageOf } from "../src/ui/message";
import { useNotifications } from "../src/ui/notifications";
import { BackHeader } from "../src/ui/screen-header";
import { keepRecording } from "../src/use-cases/media-actions";
import { captureCountdown, captureLimit } from "../src/use-cases/preferences";
import { formatClock } from "../src/ui/format";
import { playRoundCountdown } from "../src/ui/round-sound";
import { announceStoppedByHand } from "../src/ui/filmed-set";
import { attachSetVideo } from "../src/use-cases/set-video";

/**
 * Filmer la série en cours.
 *
 * La caméra est DANS l'application, et non celle du système, pour une seule
 * raison : le décompte. C'est nous qui déclenchons l'enregistrement, donc on
 * peut laisser le temps de poser le téléphone et de rejoindre la barre. En
 * passant la main à l'appli caméra, il faudrait appuyer soi-même, et la vidéo
 * montrerait surtout l'aller-retour.
 *
 * Sans le son : rien de ce qu'on vient regarder ne s'entend, et c'est une
 * permission de moins à demander pour des fichiers plus légers.
 */
export default function RecordScreen() {
  const { notify } = useNotifications();
  const router = useRouter();
  const { performance, set } = useLocalSearchParams<{
    performance: string;
    set: string;
  }>();

  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  /** Secondes restantes avant le départ, ou null quand il a eu lieu. */
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  /**
   * Où en est la captation. Trois temps, dans un seul sens : on attend le
   * départ, on filme, puis on range le fichier.
   *
   * Un simple « en train de filmer ? » revenait à faux une fois la vidéo
   * terminée -- et le décompte, resté à zéro, relançait aussitôt une seconde
   * captation, sur un écran noir, minuteur toujours en marche.
   */
  const [phase, setPhase] = useState<"waiting" | "recording" | "saving">(
    "waiting",
  );
  const recording = phase === "recording";
  /** Le départ n'a lieu qu'une fois, quoi qu'il arrive à l'écran ensuite. */
  const started = useRef(false);
  /**
   * A-t-on quitté par la croix ? La captation en cours s'interrompt alors
   * d'elle-même, et ce qu'elle rend -- fichier ou erreur -- ne concerne plus
   * personne : ni vidéo rattachée, ni second retour en arrière.
   */
  const cancelled = useRef(false);
  /**
   * L'arrêt a-t-il été COMMANDÉ ?
   *
   * `recordAsync` rend la main de la même façon qu'on ait coupé soi-même ou
   * que la durée maximale soit atteinte. Or les deux ne disent pas la même
   * chose de la série, et seul ce drapeau les distingue.
   */
  const stopped = useRef(false);
  const [ready, setReady] = useState(false);
  /** La durée maximale, en secondes ; zéro, aucune (le réglage par défaut). */
  const [limit, setLimit] = useState(0);

  useEffect(() => {
    captureCountdown()
      .then(setCountdown)
      .catch((e) => notify(messageOf(e)));
    captureLimit()
      .then(setLimit)
      .catch((e) => notify(messageOf(e)));
  }, [notify]);

  /**
   * L'enregistrement, du départ à l'arrêt.
   *
   * `recordAsync` ne rend la main qu'à la fin -- coupure manuelle ou durée
   * maximale atteinte : c'est donc ici, et non dans un bouton, que le fichier
   * est gardé et rattaché à la série.
   */
  const start = useCallback(async () => {
    if (!camera.current || started.current) return;
    started.current = true;
    setPhase("recording");
    try {
      const captured = await camera.current.recordAsync(
        limit > 0 ? { maxDuration: limit } : {},
      );
      if (cancelled.current) return;
      setPhase("saving");
      if (!captured?.uri) {
        router.back();
        return;
      }

      const name = await keepRecording(captured.uri);
      await attachSetVideo(performance, Number(set), name);
      if (stopped.current) announceStoppedByHand();
      router.back();
    } catch (e) {
      if (cancelled.current) return;
      notify(messageOf(e));
      router.back();
    }
  }, [limit, notify, performance, router, set]);

  // Le décompte, puis le départ. Une seconde à la fois, et rien d'autre ne
  // tourne pendant ce temps.
  useEffect(() => {
    if (!ready || countdown === null || phase !== "waiting") return;
    if (countdown === 0) {
      start();
      return;
    }
    const timer = setTimeout(
      () => setCountdown((left) => (left ?? 0) - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [ready, countdown, phase, start]);

  // Le temps écoulé, pendant l'enregistrement seulement : il s'arrête dès
  // qu'on a demandé l'arrêt, sans attendre que le fichier soit prêt.
  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(tick);
  }, [recording]);

  /**
   * Les cinq dernières secondes avant l'arrêt automatique, une par une : le
   * même tic que la fin d'un round d'EMOM. Le téléphone est posé loin, et
   * la vidéo allait se couper sans qu'on le sache.
   */
  const left = limit > 0 ? limit - elapsed : null;
  useEffect(() => {
    if (recording && left !== null && left > 0 && left <= 5)
      playRoundCountdown();
  }, [recording, left]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        className="flex-1 justify-between bg-background p-5 dark:bg-background-dark"
      >
        <BackHeader title="Filmer la série" onBack={() => router.back()} />
        <View className="gap-3">
          <Text className="text-body text-muted dark:text-muted-dark">
            Filmer une série demande l'accès à la caméra. Rien n'en sort : la
            vidéo reste sur ce téléphone, avec le reste de tes données.
          </Text>
          <Button
            label="Autoriser la caméra"
            size="lg"
            onPress={requestPermission}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-black">
      <View className="flex-1">
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="video"
          mute
          onCameraReady={() => setReady(true)}
        />
        {/* Par-dessus la caméra, et non dedans : elle n'accepte pas
            d'enfants, et en tenir faisait partie de ce qui la déroutait. */}
        <View className="flex-1 justify-between p-5">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => {
                cancelled.current = true;
                router.back();
              }}
              accessibilityLabel="Annuler"
              className="h-11 w-11 items-center justify-center rounded-full bg-black/40 active:opacity-60"
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>

            {/* Le temps, dans un coin et en petit : c'est la caméra qu'on
                regarde, pas un chronomètre. */}
            {phase !== "waiting" && (
              <View className="flex-row items-center gap-2 rounded-full bg-black/50 px-3 py-1.5">
                <View className="h-2.5 w-2.5 rounded-full bg-[#FF3B30]" />
                <Text
                  className="font-mono-bold text-small text-white"
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {formatClock(elapsed)}
                  {limit > 0 ? ` / ${formatClock(limit)}` : ""}
                </Text>
              </View>
            )}
          </View>

          {/* Le décompte AVANT l'enregistrement, lui, occupe le centre :
              c'est ce qu'on lit de loin, en reculant vers la barre. */}
          <View className="items-center">
            {phase === "waiting" && countdown !== null && countdown > 0 && (
              <Text className="font-mono-bold text-timer text-white">
                {countdown}
              </Text>
            )}
            {phase === "saving" && (
              <View className="items-center gap-3 rounded-2xl bg-black/50 px-5 py-4">
                <ActivityIndicator color="#FFFFFF" />
                <Text className="text-small text-white">
                  Enregistrement de la vidéo…
                </Text>
              </View>
            )}
          </View>

          <View className="items-center gap-3">
            <Text className="text-caption text-white/70">
              {phase === "waiting"
                ? "Place le téléphone, puis recule"
                : "Arrêter termine aussi la série"}
            </Text>
            {/* Le bouton d'arrêt d'un appareil photo : un anneau blanc, un
                carré rouge dedans. Il se reconnaît sans libellé. */}
            {recording && (
              <Pressable
                onPress={() => {
                  // Un second appui, pendant que le fichier se ferme, n'a
                  // plus rien à arrêter.
                  if (stopped.current) return;
                  stopped.current = true;
                  setPhase("saving");
                  camera.current?.stopRecording();
                }}
                accessibilityLabel="Arrêter"
                className="h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white active:opacity-70"
              >
                <View className="h-7 w-7 rounded-md bg-[#FF3B30]" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
