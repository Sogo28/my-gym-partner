import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAccount } from '../src/ui/account';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { formatDateTime } from '../src/ui/format';
import { initialsOf } from '../src/ui/initials';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { Sheet } from '../src/ui/sheet';
import { signOut } from '../src/use-cases/auth-actions';
import { applyBackup, type BackupPreview } from '../src/use-cases/backup-actions';
import {
  cloudState,
  forgetPushHistory,
  latestCloudBackup,
  pushBackup,
  type CloudState,
} from '../src/use-cases/cloud-backup-actions';
import { usePalette } from '../src/ui/palette';
import { ListContent, ListLayout } from '../src/ui/list-layout';

/** « 2,1 Mo » : une taille se lit, elle ne se compte pas en octets. */
function formatSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} Ko`;
  return `${Math.round((bytes / 1_000_000) * 10) / 10} Mo`;
}

/**
 * Le profil : ce qui est À TOI plutôt que ce que tu fais aujourd'hui.
 *
 * La barre d'onglets porte ce vers quoi on revient entre deux séries --
 * l'accueil, la séance, les exercices, les entraînements. L'historique et
 * les objectifs, eux, se consultent : une fois par semaine, jamais au milieu
 * d'un mouvement. Ils avaient chacun un sixième de la barre pour un usage qui
 * n'en demandait pas tant, et leur absence lui rend la lisibilité.
 *
 * Cette page est leur toit, et celui des réglages et des mensurations, qui
 * n'en avaient aucun : on les atteignait par un bouton discret dans l'en-tête
 * d'un écran qui ne les concernait pas.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { notify } = useNotifications();
  const { account, status } = useAccount();
  const [leaving, setLeaving] = useState(false);
  const [cloud, setCloud] = useState<CloudState | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  /** La sauvegarde en ligne téléchargée, en attente de confirmation. */
  const [restoring, setRestoring] = useState<BackupPreview | null>(null);

  const userId = account?.id;

  useFocusEffect(
    useCallback(() => {
      if (userId === undefined) {
        setCloud(null);
        return;
      }
      // Une panne de réseau ne doit pas transformer le profil en écran
      // d'erreur : la carte dit simplement qu'elle ne sait pas.
      cloudState(userId)
        .then(setCloud)
        .catch(() => setCloud(null));
    }, [userId]),
  );

  async function saveNow() {
    if (userId === undefined) return;
    setSaving(true);
    try {
      await pushBackup(userId);
      setCloud(await cloudState(userId));
      notify('Sauvegardé en ligne.', 'success');
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function fetchLatest() {
    if (userId === undefined) return;
    setFetching(true);
    try {
      const preview = await latestCloudBackup(userId);
      if (preview === null) notify('Aucune sauvegarde en ligne à restaurer.');
      else setRestoring(preview);
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setFetching(false);
    }
  }

  async function restore() {
    if (restoring === null) return;
    const chosen = restoring;
    setRestoring(null);
    try {
      await applyBackup(chosen.backup);
      // Ce qui vient d'être écrit n'est PAS ce qu'on avait envoyé : oublier
      // l'empreinte évite que la sauvegarde automatique se croie à jour.
      await forgetPushHistory();
      notify('Données restaurées.', 'success');
    } catch (e) {
      notify(messageOf(e));
    }
  }

  return (
    <ListLayout title="Profil" onBack={() => router.back()}>
      <ListContent className="pb-8">
        {/* Sans projet Supabase configuré, il n'y a pas de compte à proposer :
            la page se tait plutôt que d'offrir un bouton qui échouerait. */}
        {status !== 'off' && (
          <>
            <Text className="px-1 pt-1 font-bold uppercase text-label text-muted dark:text-muted-dark">
              Compte
            </Text>

            {status === 'loading' ? (
              // La session se lit dans le stockage du téléphone : c'est court,
              // mais annoncer « aucun compte » entre-temps serait faux.
              <Card density="titled">
                <Text className="text-small text-muted dark:text-muted-dark">…</Text>
              </Card>
            ) : account ? (
              <>
                <Card density="titled" className="gap-3">
                  <View className="flex-row items-center gap-3">
                    <View className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft dark:bg-primary-soft-dark">
                      <Text className="font-extrabold text-body text-primary-ink dark:text-primary-ink-dark">
                        {initialsOf(account.email)}
                      </Text>
                    </View>
                    <View className="shrink grow gap-0.5">
                      <Text
                        className="font-extrabold text-body text-ink dark:text-ink-dark"
                        numberOfLines={1}
                      >
                        {account.email}
                      </Text>
                      <Text className="font-mono text-caption text-muted dark:text-muted-dark">
                        Connecté
                      </Text>
                    </View>
                  </View>
                  <Button
                    label="Se déconnecter"
                    variant="secondary"
                    size="md"
                    onPress={() => setLeaving(true)}
                  />
                </Card>

                <Card density="titled" className="gap-2">
                  <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
                    Sauvegarde en ligne
                  </Text>
                  <Text className="text-small text-muted dark:text-muted-dark">
                    Une copie de tout part chez Supabase à l’ouverture de l’application, quand
                    quelque chose a changé. Les dix dernières sont gardées.
                  </Text>

                  <Text className="font-mono text-small text-muted dark:text-muted-dark">
                    {cloud === null
                      ? 'État inconnu · pas de réseau ?'
                      : cloud.lastSavedAt === null
                        ? 'Aucune sauvegarde en ligne'
                        : `${formatDateTime(cloud.lastSavedAt)} · ${formatSize(cloud.size)} · ${cloud.generations} copie${cloud.generations > 1 ? 's' : ''}`}
                  </Text>

                  <Button
                    label={saving ? 'Envoi…' : 'Sauvegarder maintenant'}
                    size="md"
                    disabled={saving}
                    onPress={saveNow}
                  />
                  {cloud !== null && cloud.lastSavedAt !== null && (
                    <Button
                      label={fetching ? 'Téléchargement…' : 'Restaurer la dernière'}
                      variant="secondary"
                      size="md"
                      disabled={fetching}
                      onPress={fetchLatest}
                    />
                  )}
                </Card>

                <Text className="px-1 text-small text-muted dark:text-muted-dark">
                  Ce n’est pas une synchronisation : ce téléphone reste la vérité, et restaurer
                  remplace tout ce qu’il contient.
                </Text>
              </>
            ) : (
              <Card density="titled" className="gap-2">
                <Text className="font-extrabold text-heading text-ink dark:text-ink-dark">
                  Aucun compte
                </Text>
                <Text className="text-small text-muted dark:text-muted-dark">
                  Tes données ne vivent que sur ce téléphone. Rien ne les en fera sortir tant que
                  tu ne le demandes pas, et rien ne les y retiendra s’il se perd.
                </Text>
                <Button label="Se connecter" size="md" onPress={() => router.push('/sign-in')} />
              </Card>
            )}
          </>
        )}

        <Text className="px-1 pt-4 font-bold uppercase text-label text-muted dark:text-muted-dark">
          Ton entraînement
        </Text>

        <Row
          icon="time-outline"
          title="Historique"
          detail="Tes séances passées, leurs séries et leurs temps de repos."
          onPress={() => router.push('/history')}
        />
        <Row
          icon="trophy-outline"
          title="Objectifs"
          detail="Ce que tu vises, et l'étape où tu en es."
          onPress={() => router.push('/goals')}
        />
        <Row
          icon="body-outline"
          title="Mensurations"
          detail="Tes relevés datés : poids, tours de bras, de cuisse."
          onPress={() => router.push('/body')}
        />

        <Text className="px-1 pt-4 font-bold uppercase text-label text-muted dark:text-muted-dark">
          L'application
        </Text>

        <Row
          icon="settings-outline"
          title="Réglages"
          detail="Évaluation des objectifs, catalogue d'exercices, effacement."
          onPress={() => router.push('/settings')}
        />
      </ListContent>

      <Sheet
        visible={leaving}
        title="Se déconnecter ?"
        description="Tes séances, tes exercices et tes objectifs restent sur ce téléphone : se déconnecter ne touche à rien de ce que tu as fait, et tes sauvegardes en ligne t'attendent."
        actions={[
          {
            label: 'Se déconnecter',
            onPress: () =>
              signOut()
                // L'empreinte retenue parlait des données envoyées sous CE
                // compte : la garder ferait croire au suivant qu'il est déjà
                // sauvegardé.
                .then(forgetPushHistory)
                .then(() => notify('Déconnecté.', 'success'))
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setLeaving(false)}
      />

      <Sheet
        visible={restoring !== null}
        title="Restaurer cette sauvegarde ?"
        description={
          restoring
            ? `Du ${formatDateTime(restoring.exportedAt)} · ${restoring.exercises} exercice(s), ` +
              `${restoring.sessions} séance(s). Tout ce que contient l'application sera remplacé.`
            : undefined
        }
        actions={[{ label: 'Remplacer mes données', tone: 'danger', onPress: restore }]}
        onClose={() => setRestoring(null)}
      />
    </ListLayout>
  );
}

/**
 * Une destination : son icône, son nom, et ce qu'on y trouve.
 *
 * La phrase de détail n'est pas un ornement. Une liste de quatre mots -- «
 * Historique, Objectifs, Mensurations, Réglages » -- oblige à ouvrir pour
 * savoir ; une ligne de plus par entrée évite le voyage.
 */
function Row({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { muted, primaryInk } = usePalette();

  return (
    <Pressable onPress={onPress}>
      <Card density="titled" className="flex-row items-center gap-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft dark:bg-primary-soft-dark">
          <Ionicons name={icon} size={20} color={primaryInk} />
        </View>
        <View className="shrink grow gap-0.5">
          <Text className="font-extrabold text-body text-ink dark:text-ink-dark">{title}</Text>
          <Text className="text-small text-muted dark:text-muted-dark">{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={muted} />
      </Card>
    </Pressable>
  );
}
