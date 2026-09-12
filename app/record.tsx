import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/ui/button';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { keepRecording } from '../src/use-cases/media-actions';
import { CAPTURE_MAX_SECONDS, captureCountdown } from '../src/use-cases/preferences';
import { attachSetVideo } from '../src/use-cases/set-video';

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
  const { performance, set } = useLocalSearchParams<{ performance: string; set: string }>();

  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  /** Secondes restantes avant le départ, ou null quand il a eu lieu. */
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    captureCountdown().then(setCountdown).catch((e) => notify(messageOf(e)));
  }, [notify]);

  /**
   * L'enregistrement, du départ à l'arrêt.
   *
   * `recordAsync` ne rend la main qu'à la fin -- coupure manuelle ou durée
   * maximale atteinte : c'est donc ici, et non dans un bouton, que le fichier
   * est gardé et rattaché à la série.
   */
  const start = useCallback(async () => {
    if (!camera.current) return;
    setRecording(true);
    try {
      const captured = await camera.current.recordAsync({ maxDuration: CAPTURE_MAX_SECONDS });
      if (!captured?.uri) return;

      const name = await keepRecording(captured.uri);
      await attachSetVideo(performance, Number(set), name);
      router.back();
    } catch (e) {
      notify(messageOf(e));
      router.back();
    } finally {
      setRecording(false);
    }
  }, [notify, performance, router, set]);

  // Le décompte, puis le départ. Une seconde à la fois, et rien d'autre ne
  // tourne pendant ce temps.
  useEffect(() => {
    if (!ready || countdown === null || recording) return;
    if (countdown === 0) {
      start();
      return;
    }
    const timer = setTimeout(() => setCountdown((left) => (left ?? 0) - 1), 1000);
    return () => clearTimeout(timer);
  }, [ready, countdown, recording, start]);

  // Le temps écoulé, pendant l'enregistrement seulement.
  useEffect(() => {
    if (!recording) return;
    const tick = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(tick);
  }, [recording]);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <SafeAreaView
        edges={['top', 'bottom']}
        className="flex-1 justify-between bg-background p-5 dark:bg-background-dark"
      >
        <BackHeader title="Filmer la série" onBack={() => router.back()} />
        <View className="gap-3">
          <Text className="text-body text-muted dark:text-muted-dark">
            Filmer une série demande l accès à la caméra. Rien n en sort : la vidéo reste sur ce
            téléphone, avec le reste de tes données.
          </Text>
          <Button label="Autoriser la caméra" size="lg" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-black">
      <CameraView
        ref={camera}
        style={{ flex: 1 }}
        facing="back"
        mode="video"
        mute
        onCameraReady={() => setReady(true)}
      >
        <View className="flex-1 justify-between p-5">
          <Pressable onPress={() => router.back()} className="self-start">
            <Text className="text-lead text-white">Annuler</Text>
          </Pressable>

          {/* Le décompte occupe le centre : c'est ce qu'on regarde de loin,
              en reculant vers la barre. */}
          <View className="items-center">
            {recording ? (
              <Text className="font-mono-bold text-timer text-white">
                {CAPTURE_MAX_SECONDS - elapsed}
              </Text>
            ) : (
              countdown !== null &&
              countdown > 0 && (
                <Text className="font-mono-bold text-timer text-white">{countdown}</Text>
              )
            )}
          </View>

          <View className="items-center gap-2">
            <Text className="text-caption text-white/70">
              {recording
                ? `arrêt automatique à ${CAPTURE_MAX_SECONDS} s`
                : 'place le téléphone, puis recule'}
            </Text>
            {recording && (
              <Button
                label="Arrêter"
                variant="danger"
                size="lg"
                onPress={() => camera.current?.stopRecording()}
              />
            )}
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}
