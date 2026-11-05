# Folia 🌱

Une application de suivi de plantes en français, pensée pour **Android**, avec React Native, Expo et TypeScript. Elle reconnaît une plante à partir d’une photo grâce à l’API plant.id, puis préremplit sa fiche d’entretien.

La configuration de production, les protections, les quotas, le chiffrement et
les procédures de sauvegarde sont détaillés dans [SECURITY.md](SECURITY.md).

## Lancer localement

### Démo à distance : téléphone en 4G/5G ou sur un autre Wi-Fi

Après installation des dépendances (`npm ci`), lancez une seule commande :

```bash
nvm use
npm run demo
```

Scannez le **nouveau QR code** dans Expo Go. L’application **et son API** passent par le même tunnel HTTPS Expo/ngrok : aucune IP locale à modifier et aucun second terminal API à lancer. Le téléphone et l’ordinateur ont chacun besoin d’Internet ; l’ordinateur et ce terminal doivent rester ouverts pendant la démo. `Ctrl+C` ferme le tunnel et le serveur de démonstration.

Les comptes et collections de démonstration sont conservés séparément dans `data/demo.sqlite`. Créez un compte de démonstration dans l’application : vos comptes habituels ne sont pas copiés. Relancer la démo conserve ces comptes ; `FOLIA_DEMO_DB_PATH` permet de choisir un autre fichier. Les clés `PLANT_ID_API_KEY` et `OPENAI_API_KEY` de `.env` restent sur le serveur ; sans clé, les fonctionnalités correspondantes restent indisponibles et la saisie manuelle reste utilisable.

Le lien est public et temporaire : partagez-le uniquement avec les personnes qui testent la démo. Le tunnel utilise un service tiers et peut être plus lent que le Wi-Fi local. Cette commande démarre un serveur de développement, pas un hébergement permanent. Si le tunnel échoue, vérifiez l’accès Internet et relancez la commande. Vous pouvez choisir un autre port Expo avec `npm run demo -- --port 8083` si un serveur Expo utilise déjà le port par défaut.

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
EXPO_PUBLIC_API_AUTO_LOCAL=1
EXPO_PUBLIC_API_PORT=8787
EXPO_PUBLIC_API_URL=http://192.168.1.42:8787
API_PORT=8787
FOLIA_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

Avec `EXPO_PUBLIC_API_AUTO_LOCAL=1`, l’application retrouve automatiquement l’API de l’ordinateur qui sert Expo : elle reprend l’adresse du QR code sur téléphone, et celle de la page dans le navigateur (`localhost` sur le PC). Cela couvre les changements de Wi-Fi, y compris IONIS et une nouvelle adresse attribuée sur un réseau déjà connu. Gardez `EXPO_PUBLIC_API_PORT` égal à `API_PORT`.

`EXPO_PUBLIC_API_URL` sert de repli lorsque l’hôte local ne peut pas être déterminé. Pour forcer cette adresse (API distante, par exemple), utilisez `EXPO_PUBLIC_API_AUTO_LOCAL=0`. En production, le mode automatique est désactivé et l’adresse HTTPS configurée est utilisée.

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

**Téléphone bloqué sur le nom « Phytolie » :** quittez le projet dans Expo Go, arrêtez les anciens serveurs Expo, puis lancez le mode téléphone avec un cache neuf :

```bash
npm run mobile
```

Scannez le **nouveau** QR code et gardez le terminal ouvert, jusqu’à l’affichage de `Android Bundled`, puis pendant toute l’utilisation. Le premier chargement peut prendre une minute. Ne faites pas `Ctrl+C` après le scan : cela coupe le serveur qui fournit le code au téléphone. Après une installation ou une mise à jour des dépendances, redémarrez toujours Expo.

Sur le même Wi-Fi, ouvrez `http://<IP-de-votre-ordinateur>:8081/status` dans le navigateur du téléphone : `packager-status:running` confirme l’accès à Metro (adaptez le port si Expo en affiche un autre). Le serveur API doit toujours être lancé séparément avec `npm run api`. Après un changement de Wi-Fi, redémarrez Expo et scannez le nouveau QR code : le mode automatique reprend son adresse, sans modifier `.env`. Si le mode automatique est désactivé, `EXPO_PUBLIC_API_URL` doit correspondre à l’IPv4 actuelle de l’ordinateur. Les réseaux qui isolent les appareils peuvent bloquer l’accès local ; utilisez `npm run demo` pour passer par le tunnel Internet et sa collection de démonstration séparée.

**Aperçu dans le navigateur :**

```bash
npm run web
```

Ouvrez l’adresse affichée dans le terminal (généralement `http://localhost:8081`). L’aperçu web permet de tester le carnet et les formulaires ; les notifications locales nécessitent Android. La connexion ou l’inscription est obligatoire pour accéder à la collection, conservée par le serveur Folia. Les paramètres d’accessibilité restent disponibles avant connexion.

Pour le navigateur, `FOLIA_ALLOWED_ORIGINS` dans `.env` doit contenir l’origine exacte de la page (protocole, adresse et port, sans slash final). Si Expo utilise un autre port, adaptez cette liste, puis redémarrez l’API. Avec le mode automatique, le navigateur sur le PC utilise `localhost` et reste indépendant de l’IP Wi-Fi. Si vous ouvrez le web depuis un autre appareil avec l’IP réseau de l’ordinateur, ajoutez cette origine exacte à `FOLIA_ALLOWED_ORIGINS`, puis redémarrez l’API.

**Émulateur Android :** installez Android Studio, créez un appareil virtuel dans Device Manager et démarrez-le, puis :

```bash
npm run android
```

Cette commande ouvre l’application via Expo Go sur l’appareil disponible. Elle ne construit pas un APK.

### Comptes et collections

1. Démarrez `npm run api`, puis ouvrez « Connexion / Inscription » dans l’application.
2. Créez un compte avec une adresse e-mail et un mot de passe de 12 à 128 caractères. Aucune clé de service supplémentaire n’est nécessaire.
3. Dans « Mon espace », utilisez « Importer mes plantes locales » pour copier vos anciennes plantes dans le compte. Les photos sont transférées ; la collection locale reste intacte. Relancer l’import ne duplique pas les identifiants déjà présents.
4. Connectez-vous sur un autre appareil pointant vers **le même serveur** pour retrouver vos plantes. Revenir dans « Mes plantes » récupère les modifications faites ailleurs ; sur téléphone, vous pouvez aussi tirer la liste vers le bas. Si une autre session a modifié la collection, une sauvegarde obsolète est refusée au lieu d’écraser ses changements.
5. « Se déconnecter » révoque la session, efface ses rappels programmés sur cet appareil et revient à l’écran de connexion. Un autre compte ne voit pas les fiches du précédent.

Les comptes sont stockés dans `data/folia.sqlite`, exclu de Git. Le chemin peut être changé avec `FOLIA_DB_PATH`. Sauvegardez ce fichier **serveur arrêté** pour conserver comptes et collections. Supprimer le fichier supprime les comptes ; réinstaller l’application mobile ne supprime pas les collections du serveur. Les photos sont stockées dans la collection (limite de 200 plantes et de 24 Mo par compte).

Les mots de passe sont hachés avec scrypt et un sel aléatoire. Les jetons de session sont aléatoires, stockés sous forme d’empreintes sur le serveur et uniquement en mémoire côté application : une fermeture complète ou un rechargement web demande une nouvelle connexion. La session expire après 24 h. Les tentatives d’authentification sont limitées à 20 par adresse réseau et par tranche de 15 minutes. L’adresse e-mail n’est pas vérifiée et la récupération de mot de passe n’est pas encore disponible.

Le mode compte exige une connexion au serveur pour charger ou modifier sa collection ; il n’existe pas encore de file de synchronisation hors ligne. Les modifications locales ne sont jamais importées automatiquement. Les réglages d’entretien et de rappels appartiennent au compte, mais l’autorisation de notification reste propre à chaque téléphone.

Cette configuration HTTP est destinée au développement sur un réseau local de confiance. Pour exposer les comptes sur Internet, déployez le serveur derrière HTTPS et configurez `EXPO_PUBLIC_API_URL` avec cette adresse ; les comptes ne sont pas hébergés automatiquement par ce projet. Les API de collection, de délégation, d’identification et de mesure exigent une session valide. Prévoyez également des quotas d’identification adaptés avant une exposition publique.

### En cas de difficulté

- Erreur liée à Node ou `File is not defined` : vérifiez `node --version`, puis `nvm use`.
- QR code inaccessible : vérifiez le Wi-Fi, le pare-feu et le VPN. Vous pouvez essayer `npx expo start --tunnel` (connexion Internet et installation éventuelle du module de tunnel nécessaires).
- Message « API non configurée » : vérifiez que `.env` existe, puis redémarrez Expo après toute modification du fichier.
- Connexion au compte trop longue : activez `EXPO_PUBLIC_API_AUTO_LOCAL=1`, vérifiez que `EXPO_PUBLIC_API_PORT` correspond à `API_PORT`, puis redémarrez Expo et scannez le nouveau QR code. Si le mode automatique est désactivé, vérifiez l’IPv4 de `EXPO_PUBLIC_API_URL`. L’adresse `/health` de l’API doit répondre. Dans le navigateur, vérifiez aussi `FOLIA_ALLOWED_ORIGINS` (par exemple `http://localhost:8081`). Redémarrez l’API et Expo après correction ; les avertissements Node.js sur les modules et SQLite ne signifient pas que l’API a échoué.
- Scan bloqué : ouvrez `http://<IP-de-votre-ordinateur>:8787/health` depuis le navigateur du téléphone. Une réponse `{"status":"ok"}` confirme que le serveur est joignable. Le scan vérifie cette connexion pendant 5 secondes maximum avant l’envoi de la photo. Après un changement de réseau, redémarrez Expo et scannez le nouveau QR code ; si le mode automatique est désactivé, actualisez aussi `EXPO_PUBLIC_API_URL`.
- Message « Impossible de contacter plant.id » : vérifiez que `npm run api` fonctionne, que le nouveau QR code a été scanné et que le port API configuré est accessible depuis le téléphone. Le tunnel Expo ne rend pas automatiquement ce serveur API accessible.
- Erreur 401 : la clé plant.id est incorrecte. Erreur 402 : crédits insuffisants. Erreur 403 : accès refusé. Erreur 429 : limite atteinte, vérifiez les quotas et le solde Kindwise.
- Photo refusée : le serveur convertit les images JPEG, PNG, WebP et AVIF en JPEG avant identification. Limites : 8 Mo et 40 mégapixels en entrée ; image redimensionnée à 1 400 pixels maximum par côté. Une image corrompue ou non décodable affiche une erreur explicite. Redémarrez le serveur après une mise à jour.
- Cache Metro : `npx expo start --clear`.
- Écran rouge `expo-notifications: Android Push notifications ... removed from Expo Go` : mettez à jour le code, arrêtez Expo puis relancez `npx expo start --clear` et rechargez l’application sur le téléphone. Folia utilise uniquement des rappels locaux, disponibles dans Expo Go, et charge leurs API sans initialiser les notifications push. Les notifications push distantes nécessiteraient une compilation de développement ; elles ne sont pas utilisées ici.
- Version incompatible dans Expo Go : installez une version Android compatible avec le SDK 57 depuis [expo.dev/go](https://expo.dev/go).
- Notifications absentes : autorisez-les dans Android et dans **Mon espace**. Testez sur un appareil Android ; l’économie de batterie peut retarder leur livraison.

## Documentation

- [Confidentialité et données personnelles](docs/PRIVACY.md) : notice accessible dans Mon espace, traitements et points à compléter.
- [Guide d’utilisation](docs/USAGE.md) : visuels, mesures, lumière, plan de maison, délégations et préférences.
- [Refonte UX/UI web et mobile](docs/UX_UI.md) : parcours, choix de conception et captures.
- [Développement](docs/DEVELOPMENT.md) : organisation, fichiers locaux, tests et compilation.
- [Document de référence](docs/reference/PhytoSafe.pdf).

## Ce qui fonctionne

- Mesure calibrée de la hauteur, de la largeur et du diamètre du pot, avec détection IA et correction des points.
- Marge de retard d’arrosage indicative, contextualisée et affichée dans les fiches et tâches.
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
- Compte utilisateur : inscription, connexion, déconnexion et collection privée sauvegardée sur le serveur.
- Connexion obligatoire, import des anciens carnets locaux et suppression des plantes avec confirmation.
- Personne de confiance : invitations temporaires, plantes sélectionnées, consignes, confirmations d’arrosage et révocation.
- Rappels locaux Android à l’heure choisie dans « Mon espace » (09:00 par défaut), regroupés par jour et répétés tant que l’arrosage n’est pas confirmé.
- Changer l’heure remplace les anciennes notifications ; confirmer l’arrosage relance le calendrier à la prochaine échéance. Toucher une notification ouvre « À faire ».
- Date de contrôle du rempotage et note de personne référente en cas d’absence.

Pour tester : ajoutez une plante, consultez « À faire », confirmez son arrosage, puis fermez et rouvrez l’application pour retrouver le carnet.

## Limites de cette première version

La reconnaissance est probabiliste : l’utilisateur doit contrôler la proposition et peut corriger tous les champs. plant.id annonce plus de 35 000 taxons, mais ne garantit pas toutes les plantes et ses données d’arrosage ne sont disponibles que pour une partie des espèces. La photo est envoyée au serveur local, puis à Kindwise ; consultez leurs conditions et leur politique de confidentialité avant une mise en production.

Quand plant.id ne fournit pas de donnée exploitable, Folia propose une fréquence et un terreau selon quelques familles courantes. Le moteur utilise un volume utile estimé (75 % du cylindre décrit par le diamètre et la profondeur du pot). Les coefficients Folia sont des heuristiques de départ, pas des mesures ni des prescriptions botaniques validées. Les pots irréguliers, la masse racinaire, l’humidité ambiante et la pluie ne sont pas modélisés. Le type de terreau conseillé est une note ; choisissez séparément la rétention du substrat réellement utilisé. La saison est représentée par le cycle croissance/repos choisi par l’utilisateur, sans supposer son hémisphère.

Sans capteur, l’application ne connaît pas l’humidité réelle : une observation est valable 24 h pour le conseil immédiat. Aucun volume automatique n’est proposé tant que les trous de drainage ne sont pas confirmés, ni à 5 °C ou moins en extérieur. Une date échue ne prouve pas qu’il faut arroser ; ne multipliez pas la dose par le nombre de jours de retard. Vérifiez le terreau et videz la soucoupe.

La météo provient d’[Open-Meteo](https://open-meteo.com/) et la recherche de villes de son [API de géocodage](https://open-meteo.com/en/docs/geocoding-api). La ville choisie est sauvegardée ; la température est rechargée à l’ouverture, au retour au premier plan et chaque heure. Une mesure de plus de 3 h n’est plus utilisée. Sans connexion, la température saisie reste la référence. Les rappels sont recalculés lors de l’actualisation ; l’application fermée conserve la dernière programmation. Les principes de vérification du substrat sont cohérents avec les [conseils d’arrosage de la RHS](https://www.rhs.org.uk/garden-jobs/watering) ; cette source ne valide pas les coefficients numériques de Folia.

Le scan de pièce, la compatibilité avant achat et le diagnostic de maladies restent à développer. La mesure des dimensions nécessite un repère de taille connue dans la photo ; la marge de retard est une estimation indicative, pas une garantie de survie.

Les notifications sont regroupées par jour et programmées pour les **30 prochains jours calendaires**, puis renouvelées à chaque ouverture, retour au premier plan, changement d’heure de rappel et modification du carnet. Une heure déjà passée commence au lendemain. L’heure suit le fuseau local au moment de la programmation : rouvrez l’application après un voyage. Au passage à l’heure d’été, une heure inexistante est décalée vers l’heure valide suivante, puis l’heure habituelle reprend le lendemain. Après plus de 30 jours sans ouverture, les rappels cessent. Les échéances de rempotage sont affichées dans le carnet, sans notification dédiée. Le champ référent de chaque plante reste une note. Les accès temporaires se gèrent dans « Personne de confiance ».

Les fiches et photos sont stockées sur le serveur Folia et retrouvées à la connexion ; les modifications des autres appareils sont récupérées à chaque retour dans « Mes plantes », ou en tirant la liste vers le bas sur téléphone. Les photos scannées transitent toutefois par plant.id pour l’identification. Désinstaller l’application ou effacer ses données supprime le carnet local, mais pas la collection du compte sur le serveur. Les anciennes photos ne sont pas encore nettoyées du stockage lors de la suppression d’une fiche.

## Organisation

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

Le code client est dans `src/`, le serveur dans `server/`. Les commandes restent `npm start`, `npm run web`, `npm run android` et `npm run api`. Pour vérifier le projet : `npm run typecheck` puis `npm test`.
