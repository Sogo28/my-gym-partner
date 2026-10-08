import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Deux applications distinctes sur le même téléphone (décidé le 2026-10-08).
 *
 * Le build de développement (`expo run:android`) et l'APK d'EAS portaient le
 * même identifiant, signés par deux clés différentes : passer de l'un à
 * l'autre obligeait Android à désinstaller, et désinstaller efface la base --
 * tout l'historique. Avec `APP_VARIANT=development`, la version de test prend
 * un autre identifiant et un autre nom : elle s'installe À CÔTÉ de la vraie,
 * chacune avec ses propres données.
 *
 * Tout le reste vient d'`app.json`. Sans la variable -- un build EAS de
 * production --, rien ne change.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV) return config as ExpoConfig;

  return {
    ...config,
    name: `${config.name} (dev)`,
    slug: config.slug ?? 'my-gym-partner',
    scheme: 'mygympartner-dev',
    android: {
      ...config.android,
      package: `${config.android?.package}.dev`,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: config.ios?.bundleIdentifier
        ? `${config.ios.bundleIdentifier}.dev`
        : undefined,
    },
  };
};
