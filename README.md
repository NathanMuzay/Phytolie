# Folia 🌱

Une application de suivi de plantes en français, pensée pour **Android**, avec React Native, Expo et TypeScript. Elle reconnaît une plante à partir d’une photo grâce à l’API plant.id, puis préremplit sa fiche d’entretien.

## Lancer localement

### Prérequis

- **Node.js 22.13 minimum** (Node 22 recommandé) et npm.
- Pour tester sur téléphone : **Expo Go** sur Android, compatible avec le SDK Expo 57.
- Un ordinateur et un téléphone connectés au même réseau Wi-Fi.
- Une clé API plant.id. L’inscription Kindwise fournit actuellement 100 crédits d’essai.

Depuis le dossier du projet :

```bash
# Si vous utilisez nvm
nvm install
nvm use

# Installer les versions verrouillées dans package-lock.json
npm ci
```

Créez ensuite un compte sur [Kindwise](https://admin.kindwise.com/), récupérez une clé pour **plant.id**, puis copiez le fichier de configuration :

```bash
cp .env.example .env
```

Ouvrez `.env` et renseignez :

```dotenv
PLANT_ID_API_KEY=votre_vraie_cle
EXPO_PUBLIC_API_URL=http://192.168.1.42:8787
API_PORT=8787
```

Remplacez `192.168.1.42` par l’adresse IPv4 locale de l’ordinateur. Sous Linux, vous pouvez la trouver avec `hostname -I`. N’utilisez pas `localhost` sur un téléphone physique : il désignerait le téléphone lui-même.

Lancez le serveur qui garde la clé secrète dans un premier terminal :

```bash
nvm use
npm run api
```

Puis lancez Expo dans un second terminal :

```bash
nvm use

# Démarrer le serveur de développement
npm start
```

Ouvrez Expo Go sur Android et scannez le QR code affiché dans le terminal. Gardez les deux terminaux ouverts ; `Ctrl+C` arrête chaque serveur.

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
- Message « API non configurée » : vérifiez que `.env` existe, puis redémarrez Expo après toute modification du fichier.
- Message « Impossible de contacter plant.id » : vérifiez que `npm run api` fonctionne, que `EXPO_PUBLIC_API_URL` contient l’IP de l’ordinateur et que le port `8787` est accessible depuis le téléphone. Le tunnel Expo ne rend pas automatiquement ce serveur API accessible.
- Erreur 401 : la clé plant.id est incorrecte. Erreur 429 : les crédits plant.id sont épuisés.
- Cache Metro : `npx expo start --clear`.
- Version incompatible dans Expo Go : installez une version Android compatible avec le SDK 57 depuis [expo.dev/go](https://expo.dev/go).
- Notifications absentes : autorisez-les dans Android et dans **Mon espace**. Testez sur un appareil Android ; l’économie de batterie peut retarder leur livraison.

## Ce qui fonctionne

- Reconnaissance par photo avec plant.id et affichage du niveau de confiance.
- Préremplissage du nom courant, du nom scientifique, d’un terreau et d’une fréquence de départ.
- Quantité d’eau indicative calculée depuis le diamètre du pot et ajustable avant enregistrement.
- Carnet de plantes avec photo depuis la caméra ou la galerie et saisie manuelle toujours possible.
- Fréquence personnalisée de vérification de l’arrosage, entre 1 et 90 jours.
- Écran « À faire », confirmation « J’ai arrosé » et historique.
- Sauvegarde locale persistante et suppression avec confirmation.
- Rappels locaux Android à 9 h dès l’échéance, répétés quotidiennement tant que l’arrosage n’est pas confirmé.
- Date de contrôle du rempotage et note de personne référente en cas d’absence.

Pour tester : ajoutez une plante, consultez « À faire », confirmez son arrosage, puis fermez et rouvrez l’application pour retrouver le carnet.

## Limites de cette première version

La reconnaissance est probabiliste : l’utilisateur doit contrôler la proposition et peut corriger tous les champs. plant.id annonce plus de 35 000 taxons, mais ne garantit pas toutes les plantes et ses données d’arrosage ne sont disponibles que pour une partie des espèces. La photo est envoyée au serveur local, puis à Kindwise ; consultez leurs conditions et leur politique de confidentialité avant une mise en production.

Quand plant.id ne fournit pas de donnée exploitable, Folia propose une fréquence et un terreau selon quelques familles courantes. La quantité en millilitres est une estimation basée sur le diamètre du pot, pas une mesure issue de la photo. Elle ne tient pas encore compte du volume réel du pot, de l’humidité, du drainage, de la saison ni de la météo. Un rappel invite donc toujours à vérifier le terreau avant d’arroser.

Le scan de pièce, la compatibilité avant achat, l’estimation visuelle des dimensions, la météo extérieure, la marge de retard et le diagnostic de maladies restent à développer. Une photo sans objet de taille connue ne permet pas de mesurer correctement une plante.

Les notifications sont regroupées par jour et programmées pour les **30 prochains jours**, puis renouvelées à chaque ouverture et modification du carnet. Après plus de 30 jours sans ouverture, les rappels cessent. Les échéances de rempotage sont affichées dans le carnet, sans notification dédiée. La personne référente est une simple note ; aucune invitation ni délégation distante n’est envoyée.

Les fiches et photos sauvegardées restent sur l’appareil, sans synchronisation ni export. Les photos scannées transitent toutefois par plant.id pour l’identification. Désinstaller l’application ou effacer ses données supprime le carnet. Les anciennes photos ne sont pas encore nettoyées du stockage lors de la suppression d’une fiche.

## Structure

```text
App.tsx                 Écrans, formulaires, photos et sauvegarde locale
src/model.ts            Modèle de données, échéances et historique
src/notifications.ts    Autorisation et programmation des rappels
src/plantApi.ts         Appel du serveur d’identification depuis le téléphone
src/care.ts             Valeurs d’entretien et estimation d’eau
server.mjs              Proxy local sécurisé vers plant.id
tests/model.test.mjs     Tests des règles de suivi
.env.example            Exemple de configuration sans secret
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

Documentation : [plant.id](https://www.kindwise.com/plant-id), [API v3 plant.id](https://documenter.getpostman.com/view/24599534/2s93z5A4v2), [photos Expo](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [notifications locales Expo](https://docs.expo.dev/versions/latest/sdk/notifications/).
