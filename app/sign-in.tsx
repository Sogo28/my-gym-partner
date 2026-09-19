import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/ui/button';
import { messageOf } from '../src/ui/message';
import { useNotifications } from '../src/ui/notifications';
import { BackHeader } from '../src/ui/screen-header';
import { signIn, signUp } from '../src/use-cases/auth-actions';

type Mode = 'signIn' | 'signUp';

/**
 * Se connecter, ou créer son compte -- le même formulaire.
 *
 * Deux champs identiques et un seul bouton qui change de nom : en faire deux
 * écrans aurait demandé de choisir avant de savoir, alors que la question
 * (« ai-je déjà un compte ? ») se répond en une fois et ne se repose jamais.
 *
 * L'écran ne garde AUCUNE règle sur ce qu'est un mot de passe acceptable :
 * cette règle vit chez Supabase, qui la fait respecter, et la dupliquer ici
 * garantirait seulement que les deux finissent par diverger.
 */
export default function SignInScreen() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const account = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
      notify(
        mode === 'signIn' ? `Connecté en tant que ${account.email}.` : 'Compte créé.',
        'success',
      );
      router.back();
    } catch (e) {
      notify(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-background pb-3 dark:bg-background-dark"
    >
      <View className="px-5 pt-4">
        <BackHeader
          title={mode === 'signIn' ? 'Connexion' : 'Nouveau compte'}
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 pb-8" keyboardShouldPersistTaps="handled">
        <Text className="text-small text-muted dark:text-muted-dark">
          Un compte ne change rien à ta façon de t’entraîner : tes séances continuent de vivre sur
          ce téléphone, réseau ou pas. Il sert à ce qu’elles ne disparaissent pas avec lui.
        </Text>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Adresse e-mail
          </Text>
          <TextInput
            className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-strong text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder="toi@exemple.com"
            placeholderTextColor="#A8AD9E"
            value={email}
            onChangeText={setEmail}
            // Une adresse ne porte ni majuscule initiale ni correction : les
            // deux ne produisent que des refus qu'on ne s'explique pas.
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>

        <View className="gap-2">
          <Text className="font-bold uppercase text-label text-muted dark:text-muted-dark">
            Mot de passe
          </Text>
          <TextInput
            className="h-14 rounded-lg border-[1.5px] border-border bg-surface px-4 text-strong text-ink dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            placeholder={mode === 'signIn' ? 'Ton mot de passe' : 'Six caractères au minimum'}
            placeholderTextColor="#A8AD9E"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            // Dire au gestionnaire de mots de passe s'il doit en PROPOSER un
            // ou en retrouver un : sans cela, il offre de remplir un champ
            // qu'on est en train d'inventer.
            textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            onSubmitEditing={() => {
              if (!busy) submit();
            }}
          />
        </View>

        <Button
          label={
            busy
              ? 'Un instant…'
              : mode === 'signIn'
                ? 'Se connecter'
                : 'Créer mon compte'
          }
          disabled={busy}
          onPress={submit}
        />

        {/* Changer d'intention sans changer d'écran -- et sans perdre ce qui
            est déjà tapé, puisque c'est le même formulaire. */}
        <Pressable
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          hitSlop={8}
          className="min-h-touch justify-center"
        >
          <Text className="text-center text-body text-primary-ink dark:text-primary-ink-dark">
            {mode === 'signIn' ? 'Je n’ai pas encore de compte' : 'J’ai déjà un compte'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
