# Développement et organisation

[Retour au README](../README.md) · [Guide d’utilisation](USAGE.md)

## Organisation du code

```text
index.ts                 Point d’entrée Expo
src/
  app/                   Application et navigation
  features/
    accounts/            Connexion et client des comptes
    caretakers/          Personne de confiance et délégations
    home/                Plan, éditeur PC et exposition
    light/               Mesure facultative de lumière
    measurement/         Dimensions sur photo
    plants/              Fiches, visuels, identification et entretien
    settings/            Écran des préférences
  services/              Météo et rappels
  shared/                Modèle commun, thème et accessibilité
server/                  API HTTP, comptes et services externes
tests/                   Tests automatisés
  fixtures/manual/       Photos et plan pour les essais manuels
assets/botanical/        Images réellement utilisées dans l’application
docs/                    Guides et document de référence
```

Le fichier `index.ts` charge `src/app/App.tsx`. La commande `npm run api` démarre `server/index.mjs` depuis la racine du projet, où se trouvent `.env` et le dossier `data/`.

Chaque fonctionnalité regroupe ses composants, ses règles métier et ses adaptateurs spécifiques. Les éléments communs restent dans `src/shared/` ; les intégrations météo et notifications sont dans `src/services/`. Les tests utilisent directement les règles métier et les modules serveur.

Les composants sont importés directement depuis leur fichier : aucun fichier de réexportation ou doublon n’est nécessaire. TypeScript refuse les déclarations et paramètres inutilisés (`noUnusedLocals` et `noUnusedParameters`).

## Fichiers locaux et fichiers générés

- `.env` contient la configuration locale et les clés : il reste ignoré par Git. `.env.example` documente la configuration sans secret.
- `data/` contient les comptes et collections SQLite : ce sont des données persistantes, pas un cache. Sauvegardez-les avant toute suppression.
- `node_modules/` contient les dépendances installées avec `npm ci`.
- `.expo/`, `dist/` et `web-build/` sont générés par Expo et ignorés par Git. Les sorties de compilation ne sont pas des sources.
- `tests/fixtures/manual/` conserve les exemples de photos et de plan ; ils ne sont pas chargés dans l’application.
- `docs/reference/PhytoSafe.pdf` conserve le document de référence du projet.

## Vérifications

```bash
npm run typecheck
npm test
npx expo export --platform android
npx expo export --platform web
```

Pour vérifier les notifications sur Android :

1. Dans « Mon espace », autorisez les rappels et choisissez une heure deux minutes dans le futur, puis enregistrez.
2. Ajoutez une plante sans arrosage connu. Passez l’application en arrière-plan et attendez l’heure choisie.
3. Touchez la notification : « À faire » doit s’ouvrir. Confirmez « J’ai arrosé » : la prochaine échéance remplace les relances de cette plante.
4. Changez l’heure, puis désactivez les rappels : les anciennes notifications programmées doivent disparaître. Le message de programmation indique un échec si l’autorisation système a été retirée.

Les tests automatisés couvrent le calendrier et l’adaptateur de programmation simulé ; la livraison effective dépend du téléphone, des autorisations et des restrictions de batterie Android.

L’export Android vérifie la génération du bundle JavaScript ; il ne produit pas un APK et ne remplace pas un test sur téléphone.

Pour une compilation native locale avec le SDK Android et Java configurés : `npx expo run:android`. Cette commande génère le dossier Android et compile une application de développement ; le premier lancement télécharge les dépendances Gradle nécessaires.

Documentation : [plant.id](https://www.kindwise.com/plant-id), [API v3 plant.id](https://documenter.getpostman.com/view/24599534/2s93z5A4v2), [photos Expo](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [notifications locales Expo](https://docs.expo.dev/versions/latest/sdk/notifications/).

