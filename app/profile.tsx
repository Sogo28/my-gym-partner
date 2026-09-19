import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount } from '../src/ui/account';
import { Button } from '../src/ui/button';
import { Card } from '../src/ui/card';
import { initialsOf } from '../src/ui/initials';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { Sheet } from '../src/ui/sheet';
import { signOut } from '../src/use-cases/auth-actions';

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

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <BackHeader title="Profil" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-8">
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
                      connecté
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
      </ScrollView>

      <Sheet
        visible={leaving}
        title="Se déconnecter ?"
        description="Tes séances, tes exercices et tes objectifs restent sur ce téléphone : se déconnecter ne touche à rien de ce que tu as fait."
        actions={[
          {
            label: 'Se déconnecter',
            onPress: () =>
              signOut()
                .then(() => notify('Déconnecté.', 'success'))
                .catch((e) => notify(messageOf(e))),
          },
        ]}
        onClose={() => setLeaving(false)}
      />
    </SafeAreaView>
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
  return (
    <Pressable onPress={onPress}>
      <Card density="titled" className="flex-row items-center gap-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-alt dark:bg-surface-alt-dark">
          <Ionicons name={icon} size={20} color="#8B9086" />
        </View>
        <View className="shrink grow gap-0.5">
          <Text className="font-extrabold text-body text-ink dark:text-ink-dark">{title}</Text>
          <Text className="text-small text-muted dark:text-muted-dark">{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8B9086" />
      </Card>
    </Pressable>
  );
}
