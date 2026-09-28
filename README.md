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
- Scan bloqué : ouvrez `http://<IP-de-votre-ordinateur>:8787/health` depuis le navigateur du téléphone. Une réponse `{"status":"ok"}` confirme que le serveur est joignable. Le scan vérifie cette connexion pendant 5 secondes maximum avant l’envoi de la photo. Après un changement de réseau, mettez à jour `EXPO_PUBLIC_API_URL` et redémarrez Expo.
- Message « Impossible de contacter plant.id » : vérifiez que `npm run api` fonctionne, que `EXPO_PUBLIC_API_URL` contient l’IP de l’ordinateur et que le port `8787` est accessible depuis le téléphone. Le tunnel Expo ne rend pas automatiquement ce serveur API accessible.
- Erreur 401 : la clé plant.id est incorrecte. Erreur 429 : les crédits plant.id sont épuisés.
- Cache Metro : `npx expo start --clear`.
- Version incompatible dans Expo Go : installez une version Android compatible avec le SDK 57 depuis [expo.dev/go](https://expo.dev/go).
- Notifications absentes : autorisez-les dans Android et dans **Mon espace**. Testez sur un appareil Android ; l’économie de batterie peut retarder leur livraison.

## Ce qui fonctionne

- Reconnaissance par photo avec plant.id et jusqu’à cinq propositions classées par confiance.
- À partir de 80 % de confiance, la première proposition préremplit la fiche ; sinon, choix explicite ou saisie manuelle. Toutes les propositions restent sélectionnables.
- Fiche d’entretien du résultat choisi : espèce, famille et description lorsqu’elles sont disponibles, terreau, fréquence et dose indicatives. Les informations de plant.id sont distinguées des estimations Folia.
- Le choix d’une autre espèce conserve le surnom et la photo. La famille et la description sont sauvegardées avec la plante.
- Préremplissage du nom courant, du nom scientifique, d’un terreau et d’une fréquence de départ.
- Calcul automatique de la fréquence de vérification et de la dose indicative selon l’espèce, le diamètre et la profondeur du pot, son matériau, le drainage, la rétention du substrat, la température, l’exposition et le cycle croissance/repos. Les anciennes fiches conservent leurs réglages manuels ; activez le calcul dans « Modifier la fiche ».
- Dernier arrosage connu saisissable à l’ajout, puis historique des confirmations. Les échéances partent du dernier arrosage, jamais de la date d’ouverture.
- Observation « terreau encore humide » : dose suspendue pendant 24 h et vérification reportée au moins au lendemain, sans créer d’arrosage. « Terreau sec » avance la vérification.
- Météo extérieure par ville dans « Mon espace » : choix parmi les homonymes, actualisation horaire et au retour dans l’application. La température météo concerne uniquement les plantes en extérieur. En cas d’échec, la température saisie est utilisée.
- Modification des fiches depuis « Modifier la fiche », avec conservation de l’historique des arrosages.
- Tri de la collection par urgence (activé par défaut, désactivable) et échéances visibles dans les fiches.
- Carnet de plantes avec photo depuis la caméra ou la galerie et saisie manuelle toujours possible.
- Fréquence personnalisée de vérification de l’arrosage, entre 1 et 90 jours.
- Écran « À faire », confirmation « J’ai arrosé » et historique.
- Sauvegarde locale persistante et suppression avec confirmation.
- Rappels locaux Android à l’heure choisie dans « Mon espace » (09:00 par défaut), regroupés par jour et répétés tant que l’arrosage n’est pas confirmé.
- Changer l’heure remplace les anciennes notifications ; confirmer l’arrosage relance le calendrier à la prochaine échéance. Toucher une notification ouvre « À faire ».
- Date de contrôle du rempotage et note de personne référente en cas d’absence.

Pour tester : ajoutez une plante, consultez « À faire », confirmez son arrosage, puis fermez et rouvrez l’application pour retrouver le carnet.

## Limites de cette première version

La reconnaissance est probabiliste : l’utilisateur doit contrôler la proposition et peut corriger tous les champs. plant.id annonce plus de 35 000 taxons, mais ne garantit pas toutes les plantes et ses données d’arrosage ne sont disponibles que pour une partie des espèces. La photo est envoyée au serveur local, puis à Kindwise ; consultez leurs conditions et leur politique de confidentialité avant une mise en production.

Quand plant.id ne fournit pas de donnée exploitable, Folia propose une fréquence et un terreau selon quelques familles courantes. Le moteur utilise un volume utile estimé (75 % du cylindre décrit par le diamètre et la profondeur du pot). Les coefficients Folia sont des heuristiques de départ, pas des mesures ni des prescriptions botaniques validées. Les pots irréguliers, la masse racinaire, l’humidité ambiante et la pluie ne sont pas modélisés. Le type de terreau conseillé est une note ; choisissez séparément la rétention du substrat réellement utilisé. La saison est représentée par le cycle croissance/repos choisi par l’utilisateur, sans supposer son hémisphère.

Sans capteur, l’application ne connaît pas l’humidité réelle : une observation est valable 24 h pour le conseil immédiat. Aucun volume automatique n’est proposé tant que les trous de drainage ne sont pas confirmés, ni à 5 °C ou moins en extérieur. Une date échue ne prouve pas qu’il faut arroser ; ne multipliez pas la dose par le nombre de jours de retard. Vérifiez le terreau et videz la soucoupe.

La météo provient d’[Open-Meteo](https://open-meteo.com/) et la recherche de villes de son [API de géocodage](https://open-meteo.com/en/docs/geocoding-api). La ville choisie est sauvegardée ; la température est rechargée à l’ouverture, au retour au premier plan et chaque heure. Une mesure de plus de 3 h n’est plus utilisée. Sans connexion, la température saisie reste la référence. Les rappels sont recalculés lors de l’actualisation ; l’application fermée conserve la dernière programmation. Les principes de vérification du substrat sont cohérents avec les [conseils d’arrosage de la RHS](https://www.rhs.org.uk/garden-jobs/watering) ; cette source ne valide pas les coefficients numériques de Folia.

Le scan de pièce, la compatibilité avant achat, l’estimation visuelle des dimensions, la marge de retard et le diagnostic de maladies restent à développer. Une photo sans objet de taille connue ne permet pas de mesurer correctement une plante.

Les notifications sont regroupées par jour et programmées pour les **30 prochains jours calendaires**, puis renouvelées à chaque ouverture, retour au premier plan, changement d’heure de rappel et modification du carnet. Une heure déjà passée commence au lendemain. L’heure suit le fuseau local au moment de la programmation : rouvrez l’application après un voyage. Au passage à l’heure d’été, une heure inexistante est décalée vers l’heure valide suivante, puis l’heure habituelle reprend le lendemain. Après plus de 30 jours sans ouverture, les rappels cessent. Les échéances de rempotage sont affichées dans le carnet, sans notification dédiée. La personne référente est une simple note ; aucune invitation ni délégation distante n’est envoyée.

Les fiches et photos sauvegardées restent sur l’appareil, sans synchronisation ni export. Les photos scannées transitent toutefois par plant.id pour l’identification. Désinstaller l’application ou effacer ses données supprime le carnet. Les anciennes photos ne sont pas encore nettoyées du stockage lors de la suppression d’une fiche.

## Structure

```text
App.tsx                 Écrans, formulaires, photos et sauvegarde locale
src/model.ts            Modèle de données, échéances et historique
src/notifications.ts    Autorisation et programmation native des rappels
src/reminders.ts        Regroupement, remplacement et nettoyage des relances
src/plantApi.ts         Appel du serveur d’identification depuis le téléphone
src/care.ts             Valeurs d’entretien et estimation d’eau
src/irrigation.ts       Calcul contextualisé et observations d’humidité
src/weather.ts          Géocodage et température extérieure Open-Meteo
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

Pour vérifier les notifications sur Android :

1. Dans « Mon espace », autorisez les rappels et choisissez une heure deux minutes dans le futur, puis enregistrez.
2. Ajoutez une plante sans arrosage connu. Passez l’application en arrière-plan et attendez l’heure choisie.
3. Touchez la notification : « À faire » doit s’ouvrir. Confirmez « J’ai arrosé » : la prochaine échéance remplace les relances de cette plante.
4. Changez l’heure, puis désactivez les rappels : les anciennes notifications programmées doivent disparaître. Le message de programmation indique un échec si l’autorisation système a été retirée.

Les tests automatisés couvrent le calendrier et l’adaptateur de programmation simulé ; la livraison effective dépend du téléphone, des autorisations et des restrictions de batterie Android.

L’export Android vérifie la génération du bundle JavaScript ; il ne produit pas un APK et ne remplace pas un test sur téléphone.

Pour une compilation native locale avec le SDK Android et Java configurés : `npx expo run:android`. Cette commande génère le dossier Android et compile une application de développement ; le premier lancement télécharge les dépendances Gradle nécessaires.

Documentation : [plant.id](https://www.kindwise.com/plant-id), [API v3 plant.id](https://documenter.getpostman.com/view/24599534/2s93z5A4v2), [photos Expo](https://docs.expo.dev/versions/latest/sdk/imagepicker/), [notifications locales Expo](https://docs.expo.dev/versions/latest/sdk/notifications/).
