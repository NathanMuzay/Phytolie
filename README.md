# Folia 🌱

Une première base d’application de suivi de plantes, en français, pensée pour **Android**, avec React Native, Expo et TypeScript. Elle fonctionne sans compte, sans backend et sans clé API.

## Lancer localement

### Prérequis

- **Node.js 22.13 minimum** (Node 22 recommandé) et npm.
- Pour tester sur téléphone : **Expo Go** sur Android, compatible avec le SDK Expo 57.
- Un ordinateur et un téléphone connectés au même réseau Wi-Fi.

Depuis le dossier du projet :

```bash
# Si vous utilisez nvm
nvm install
nvm use

# Installer les versions verrouillées dans package-lock.json
npm ci

# Démarrer le serveur de développement
npm start
```

Ouvrez Expo Go sur Android et scannez le QR code affiché dans le terminal. Les modifications du code sont rechargées automatiquement. Gardez le terminal ouvert ; `Ctrl+C` arrête le serveur.

**Aperçu dans le navigateur :**

```bash
npm run web
```

Ouvrez l’adresse affichée dans le terminal (généralement `http://localhost:8081`). L’aperçu web permet de tester le carnet et les formulaires ; les notifications locales nécessitent Android. La sauvegarde web est propre au navigateur et à l’adresse utilisés.

**Émulateur Android :** installez Android Studio, créez un appareil virtuel dans Device Manager et démarrez-le, puis :

```bash
npm run android
```

Cette commande ouvre l’application via Expo Go sur l’appareil disponible. Elle ne construit pas un APK.

### En cas de difficulté

- Erreur liée à Node ou `File is not defined` : vérifiez `node --version`, puis `nvm use`.
- QR code inaccessible : vérifiez le Wi-Fi, le pare-feu et le VPN. Vous pouvez essayer `npx expo start --tunnel` (connexion Internet et installation éventuelle du module de tunnel nécessaires).
- Cache Metro : `npx expo start --clear`.
- Version incompatible dans Expo Go : installez une version Android compatible avec le SDK 57 depuis [expo.dev/go](https://expo.dev/go).
- Notifications absentes : autorisez-les dans Android et dans **Mon espace**. Testez sur un appareil Android ; l’économie de batterie peut retarder leur livraison.

## Ce qui fonctionne

- Carnet de plantes avec photo depuis la caméra ou la galerie.
- Ajout manuel de toute espèce, nom, pièce, dimensions, terreau et température.
- Fréquence personnalisée de vérification de l’arrosage, entre 1 et 90 jours.
- Écran « À faire », confirmation « J’ai arrosé » et historique.
- Sauvegarde locale persistante et suppression avec confirmation.
- Rappels locaux Android à 9 h dès l’échéance, répétés quotidiennement tant que l’arrosage n’est pas confirmé.
- Date de contrôle du rempotage et note de personne référente en cas d’absence.

Pour tester : ajoutez une plante, consultez « À faire », confirmez son arrosage, puis fermez et rouvrez l’application pour retrouver le carnet.

## Limites de cette première version

La photo sert à illustrer la fiche : **aucune reconnaissance automatique ni analyse de santé n’est branchée**. Le scan de pièce, la météo extérieure, la compatibilité avant achat, l’estimation des dimensions, la quantité d’eau et la marge de retard tolérable restent à développer. Aucune couverture fiable de toutes les espèces n’est promise.

La fréquence de 7 jours proposée dans le formulaire est une valeur éditable, pas une recommandation botanique. La température, la taille et le terreau sont conservés comme observations et ne déclenchent aucun calcul automatique. Un rappel invite à vérifier la plante, sans prescrire un arrosage systématique.

Les notifications sont regroupées par jour et programmées pour les **30 prochains jours**, puis renouvelées à chaque ouverture et modification du carnet. Après plus de 30 jours sans ouverture, les rappels cessent. Les échéances de rempotage sont affichées dans le carnet, sans notification dédiée. La personne référente est une simple note ; aucune invitation ni délégation distante n’est envoyée.

Les données et les photos restent sur l’appareil, sans synchronisation ni export. Désinstaller l’application ou effacer ses données supprime le carnet. Les anciennes photos ne sont pas encore nettoyées du stockage lors de la suppression d’une fiche.

## Structure

```text
App.tsx                 Écrans, formulaires, photos et sauvegarde locale
src/model.ts            Modèle de données, échéances et historique
src/notifications.ts    Autorisation et programmation des rappels
tests/model.test.mjs     Tests des règles de suivi
app.json                Configuration Expo et permissions Android
```

## Vérifications

```bash
npm run typecheck
npm test
npx expo export --platform android
npx expo export --platform web
```

L’export Android vérifie la génération du bundle JavaScript ; il ne produit pas un APK et ne remplace pas un test sur téléphone.

Pour une compilation native locale avec le SDK Android et Java configurés : `npx expo run:android`. Cette commande génère le dossier Android et compile une application de développement ; le premier lancement télécharge les dépendances Gradle nécessaires.

Documentation des modules utilisés : [photos](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [notifications locales](https://docs.expo.dev/versions/latest/sdk/notifications/).
