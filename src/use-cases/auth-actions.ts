import { AuthError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { DomainError } from '../domain/domain-error';
import { supabase } from '../infra/supabase';

/**
 * Le compte connecté, réduit à ce dont l'application a besoin.
 *
 * Supabase rend un objet `User` d'une trentaine de champs. En laisser passer
 * la forme jusqu'aux écrans, c'est accepter qu'un changement chez Supabase
 * atteigne la page d'accueil.
 */
export type Account = {
  readonly id: string;
  readonly email: string;
};

function accountOf(session: Session | null): Account | null {
  if (session === null) return null;
  const { id, email } = session.user;
  // Un compte créé par e-mail EN A un. La garde couvre les comptes anonymes
  // et les connexions par téléphone, qu'on ne propose pas.
  return email ? { id, email } : null;
}

/** Le compte connecté, ou null. Lu depuis le stockage, sans réseau. */
export async function currentAccount(): Promise<Account | null> {
  const { data, error } = await supabase().auth.getSession();
  if (error) throw translated(error);
  return accountOf(data.session);
}

export async function signIn(email: string, password: string): Promise<Account> {
  refuseEmpty(email, password);

  const { data, error } = await supabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw translated(error);

  return expectAccount(data.session);
}

/**
 * Crée le compte ET connecte.
 *
 * La confirmation par e-mail est désactivée sur le projet : l'inscription
 * rend donc une session tout de suite. Si elle était rallumée, `session`
 * serait nul et il faudrait aller chercher le lien dans sa boîte -- d'où le
 * message explicite plutôt qu'un écran qui ne réagit pas.
 */
export async function signUp(email: string, password: string): Promise<Account> {
  refuseEmpty(email, password);

  const { data, error } = await supabase().auth.signUp({ email: email.trim(), password });
  if (error) throw translated(error);

  if (data.session === null) {
    throw new DomainError(
      'Ton compte est créé, mais il attend que tu confirmes ton adresse : ouvre le message que Supabase vient de t’envoyer.',
    );
  }

  return expectAccount(data.session);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  if (error) throw translated(error);
}

/**
 * Suit le compte connecté, et rend de quoi arrêter de le suivre.
 *
 * Se déconnecter, expirer, renouveler son jeton : autant d'événements qui
 * arrivent sans que personne ne les ait demandés à l'écran. Les guetter vaut
 * mieux que relire le compte à chaque affichage.
 */
export function watchAccount(listen: (account: Account | null) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((_event, session) => {
    listen(accountOf(session));
  });
  return () => data.subscription.unsubscribe();
}

/** Une session sans compte lisible ne devrait pas exister ; si elle arrive, elle se dit. */
function expectAccount(session: Session | null): Account {
  const account = accountOf(session);
  if (account === null) {
    throw new Error('Supabase a rendu une session sans utilisateur ni adresse.');
  }
  return account;
}

/**
 * Deux champs vides n'ont pas besoin d'un aller-retour réseau pour être
 * refusés, ni d'un message écrit en anglais par un serveur.
 */
function refuseEmpty(email: string, password: string): void {
  if (email.trim() === '') throw new DomainError('Il faut une adresse e-mail.');
  if (password === '') throw new DomainError('Il faut un mot de passe.');
}

/**
 * Le refus de Supabase, dit dans la langue de l'application.
 *
 * Supabase répond en anglais, à un développeur. « Invalid login credentials »
 * n'a rien à faire sous un champ de mot de passe. On traduit donc ce qui peut
 * réellement arriver dans un formulaire e-mail + mot de passe, en s'appuyant
 * sur le CODE de l'erreur et non sur son texte : le code est un contrat, le
 * texte change au gré des versions.
 *
 * Ce qui n'est pas prévu ici reste une panne, et sera annoncé comme telle --
 * mieux vaut « quelque chose n'a pas fonctionné » qu'une phrase anglaise
 * présentée comme une règle.
 */
function translated(error: AuthError): Error {
  // Pas de réseau : le cas le plus banal dans une salle en sous-sol, et le
  // seul que l'utilisateur puisse corriger lui-même.
  if (error instanceof AuthRetryableFetchError) {
    return new DomainError(
      'Impossible de joindre le serveur. Vérifie ta connexion — tes séances, elles, n’en ont pas besoin.',
    );
  }

  switch (error.code) {
    case 'invalid_credentials':
      return new DomainError('Adresse e-mail ou mot de passe incorrect.');
    case 'user_already_exists':
    case 'email_exists':
      return new DomainError(
        'Un compte existe déjà avec cette adresse. Connecte-toi plutôt que d’en créer un autre.',
      );
    case 'weak_password':
      return new DomainError('Mot de passe trop court : il en faut six caractères au minimum.');
    case 'email_address_invalid':
    case 'validation_failed':
      return new DomainError('Cette adresse e-mail n’a pas l’air valide.');
    case 'email_not_confirmed':
      return new DomainError(
        'Ton adresse n’est pas confirmée : ouvre le message que Supabase t’a envoyé.',
      );
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new DomainError('Trop d’essais d’affilée. Laisse passer une minute.');
    case 'signup_disabled':
      return new DomainError('Les inscriptions sont fermées sur ce projet.');
    case 'user_banned':
      return new DomainError('Ce compte est suspendu.');
    default:
      return error;
  }
}
