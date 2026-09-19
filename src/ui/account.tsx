import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSupabaseConfigured } from '../infra/supabase';
import { currentAccount, watchAccount, type Account } from '../use-cases/auth-actions';

/**
 * Le compte connecté, disponible partout sans que personne ne le relise.
 *
 * Trois écrans s'y intéressent -- l'avatar de l'accueil, le profil, la page
 * de connexion -- et une déconnexion doit les atteindre tous les trois en
 * même temps. Chacun interrogeant Supabase de son côté, l'avatar aurait gardé
 * ses initiales pendant que le profil affichait « aucun compte ».
 *
 * `status` compte autant que `account` : au démarrage, la session se lit dans
 * le stockage du téléphone, ce qui prend un instant. Sans cet état, l'écran
 * conclurait « pas de compte » pendant ce délai, et proposerait de se
 * connecter à quelqu'un qui l'est déjà.
 */
type AccountState = {
  readonly account: Account | null;
  /** `loading` : on ne sait pas encore. `off` : aucun projet Supabase configuré. */
  readonly status: 'loading' | 'ready' | 'off';
};

const AccountContext = createContext<AccountState>({ account: null, status: 'loading' });

export function AccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>({
    account: null,
    status: isSupabaseConfigured ? 'loading' : 'off',
  });

  useEffect(() => {
    // Sans configuration, il n'y a personne à suivre et rien à attendre :
    // l'application reste ce qu'elle a toujours été, entièrement locale.
    if (!isSupabaseConfigured) return;

    let alive = true;

    currentAccount()
      .then((account) => {
        if (alive) setState({ account, status: 'ready' });
      })
      .catch(() => {
        // Une session illisible n'est pas un écran en erreur : c'est un
        // compte déconnecté. L'application marche sans.
        if (alive) setState({ account: null, status: 'ready' });
      });

    // Déconnexion, expiration, jeton renouvelé : autant d'événements qui
    // arrivent sans qu'un écran les ait demandés.
    const stop = watchAccount((account) => {
      if (alive) setState({ account, status: 'ready' });
    });

    return () => {
      alive = false;
      stop();
    };
  }, []);

  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}
