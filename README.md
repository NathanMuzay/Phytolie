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

Ouvrez l’adresse affichée dans le terminal (généralement `http://localhost:8081`). L’aperçu web permet de tester le carnet et les formulaires ; les notifications locales nécessitent Android. En mode local, la sauvegarde web est propre au navigateur et à l’adresse utilisés. Avec un compte, la collection est conservée par le serveur Folia.

**Émulateur Android :** installez Android Studio, créez un appareil virtuel dans Device Manager et démarrez-le, puis :

```bash
npm run android
```

Cette commande ouvre l’application via Expo Go sur l’appareil disponible. Elle ne construit pas un APK.

### Comptes et collections

1. Démarrez `npm run api`, puis ouvrez « Connexion / Inscription » dans l’application.
2. Créez un compte avec une adresse e-mail et un mot de passe de 12 à 128 caractères. Aucune clé de service supplémentaire n’est nécessaire.
3. Dans « Mon espace », utilisez « Importer mes plantes locales » pour copier vos anciennes plantes dans le compte. Les photos sont transférées ; la collection locale reste intacte. Relancer l’import ne duplique pas les identifiants déjà présents.
4. Connectez-vous sur un autre appareil pointant vers **le même serveur** pour retrouver vos plantes. « Recharger la collection » récupère les modifications faites ailleurs. Si une autre session a modifié la collection, une sauvegarde obsolète est refusée au lieu d’écraser ses changements.
5. « Se déconnecter » révoque la session, efface ses rappels programmés sur cet appareil et revient à la collection locale. Un autre compte ne voit pas les fiches du précédent.

Les comptes sont stockés dans `data/folia.sqlite`, exclu de Git. Le chemin peut être changé avec `FOLIA_DB_PATH`. Sauvegardez ce fichier **serveur arrêté** pour conserver comptes et collections. Supprimer le fichier supprime les comptes ; réinstaller l’application mobile ne supprime pas les collections du serveur. Les photos sont stockées dans la collection (limite de 200 plantes et de 24 Mo par compte).

Les mots de passe sont hachés avec scrypt et un sel aléatoire. Les jetons de session sont aléatoires, stockés sous forme d’empreintes sur le serveur et uniquement en mémoire côté application : une fermeture complète ou un rechargement web demande une nouvelle connexion. La session expire après 24 h. Les tentatives d’authentification sont limitées à 20 par adresse réseau et par tranche de 15 minutes. L’adresse e-mail n’est pas vérifiée et la récupération de mot de passe n’est pas encore disponible.

Le mode compte exige une connexion au serveur pour charger ou modifier sa collection ; il n’existe pas encore de file de synchronisation hors ligne. Les modifications locales ne sont jamais importées automatiquement. Les réglages d’entretien et de rappels appartiennent au compte, mais l’autorisation de notification reste propre à chaque téléphone.

Cette configuration HTTP est destinée au développement sur un réseau local de confiance. Pour exposer les comptes sur Internet, déployez le serveur derrière HTTPS et configurez `EXPO_PUBLIC_API_URL` avec cette adresse ; les comptes ne sont pas hébergés automatiquement par ce projet. Le proxy d’identification reste accessible au mode local : ne l’exposez pas publiquement sans contrôle d’accès et quotas adaptés.

### En cas de difficulté

- Erreur liée à Node ou `File is not defined` : vérifiez `node --version`, puis `nvm use`.
- QR code inaccessible : vérifiez le Wi-Fi, le pare-feu et le VPN. Vous pouvez essayer `npx expo start --tunnel` (connexion Internet et installation éventuelle du module de tunnel nécessaires).
- Message « API non configurée » : vérifiez que `.env` existe, puis redémarrez Expo après toute modification du fichier.
- Scan bloqué : ouvrez `http://<IP-de-votre-ordinateur>:8787/health` depuis le navigateur du téléphone. Une réponse `{"status":"ok"}` confirme que le serveur est joignable. Le scan vérifie cette connexion pendant 5 secondes maximum avant l’envoi de la photo. Après un changement de réseau, mettez à jour `EXPO_PUBLIC_API_URL` et redémarrez Expo.
- Message « Impossible de contacter plant.id » : vérifiez que `npm run api` fonctionne, que `EXPO_PUBLIC_API_URL` contient l’IP de l’ordinateur et que le port `8787` est accessible depuis le téléphone. Le tunnel Expo ne rend pas automatiquement ce serveur API accessible.
- Erreur 401 : la clé plant.id est incorrecte. Erreur 402 : crédits insuffisants. Erreur 403 : accès refusé. Erreur 429 : limite atteinte, vérifiez les quotas et le solde Kindwise.
- Photo refusée : le serveur convertit les images JPEG, PNG, WebP et AVIF en JPEG avant identification. Limites : 8 Mo et 40 mégapixels en entrée ; image redimensionnée à 1 400 pixels maximum par côté. Une image corrompue ou non décodable affiche une erreur explicite. Redémarrez le serveur après une mise à jour.
- Cache Metro : `npx expo start --clear`.
- Version incompatible dans Expo Go : installez une version Android compatible avec le SDK 57 depuis [expo.dev/go](https://expo.dev/go).
- Notifications absentes : autorisez-les dans Android et dans **Mon espace**. Testez sur un appareil Android ; l’économie de batterie peut retarder leur livraison.

## Choisir le visuel d’une plante

Dans « Ajouter une plante » ou « Modifier la fiche », choisissez **Ma photo** ou **Visuel botanique**. Après un scan, une identification avec au moins 80 % de confiance sélectionne automatiquement le visuel botanique. En dessous de ce seuil, choisissez une proposition pour déclencher le même comportement. Les illustrations locales couvrent Monstera deliciosa, Aloe vera, Ficus elastica et Nephrolepis exaltata ; pour les autres espèces, plant.id fournit une photo représentative avec son attribution et sa licence. En l’absence de photo de référence, votre photo personnelle reste affichée (ou une composition décorative si aucune photo n’est disponible). Le visuel suit l’espèce renseignée et le choix est sauvegardé avec la fiche.

La photo personnelle reste conservée lorsque vous affichez un visuel botanique. Choisissez **Photo entière** pour éviter de couper les feuilles ou **Remplir le cadre** pour un affichage recadré. Le carnet et les fiches partagent un cadre adaptatif au format 4:3. L’identification et les mesures utilisent uniquement votre photo originale. La photo de référence nécessite une connexion ; changer manuellement l’espèce efface la référence de l’ancienne espèce. Redémarrez `npm run api` après cette mise à jour pour obtenir les images dans les réponses de scan.

## Mesurer les dimensions sur photo

Dans « Ajouter une plante » ou « Modifier la fiche », ajoutez une photo, puis ouvrez **Dimensions sur photo → Mesurer cette photo**.

1. Photographiez de face la plante entière et son pot de culture, avec une règle ou une feuille A4 placée à côté **à la même distance de l’appareil**. Le niveau du terreau et l’ouverture du pot doivent être visibles. Évitez les perspectives fortes, le grand-angle, les plantes tronquées et les cache-pots masquant le pot intérieur.
2. Décrivez le segment de référence et sa longueur réelle : par défaut, le grand côté vertical d’une feuille A4 (29,7 cm).
3. Appuyez sur **Détecter automatiquement les points**. Le serveur utilise l’API de vision OpenAI et renvoie huit points normalisés. La hauteur du terreau au sommet, la largeur du feuillage et le diamètre de l’ouverture du pot sont ensuite calculés par rapport au repère.
4. Vérifiez les points numérotés : choisissez un point puis touchez la photo pour le corriger. Vous pouvez aussi placer les huit points directement, **sans clé API, sans réseau et sans analyse IA**.
5. Appuyez sur **Appliquer les dimensions à la fiche**, puis enregistrez la plante. Les valeurs restent modifiables ; leur origine et leur date sont conservées en mode local et en mode compte. Modifier une dimension manuellement retire l’attribution à la mesure photo.

Pour la détection automatique, ajoutez ces paramètres au `.env` du serveur et redémarrez `npm run api` :

```dotenv
OPENAI_API_KEY=votre_cle_openai
OPENAI_VISION_MODEL=gpt-4.1
```

La clé reste sur le serveur, sans préfixe `EXPO_PUBLIC_`. Les appels à ce service peuvent être facturés par le fournisseur. L’identification plant.id conserve sa propre clé ; la route de mesure `/measure` fonctionne indépendamment de plant.id. Elle accepte JPEG, PNG et WebP, avec une limite de corps JSON de 12 Mo, et limite les demandes à 20 par adresse réseau sur 15 minutes. Comme le proxy d’identification, cette route est prévue pour un serveur de développement privé ; un déploiement public demande une authentification et des quotas adaptés.

L’image n’est envoyée à OpenAI qu’en appuyant sur le bouton de détection. La requête utilise `store: false` ; cela ne constitue pas une garantie de rétention nulle chez le fournisseur. Les points sont des propositions, à contrôler avant application. La géométrie tient compte du ratio de la photo et des bandes autour de l’image affichée. Un repère trop petit ou des dimensions incohérentes sont refusés. Une vue unique ne corrige pas la perspective, ne mesure pas la profondeur intérieure utile du pot et ne garantit pas une précision métrique : la profondeur reste saisie manuellement. Une photo non exploitable ou un service indisponible laisse le placement manuel accessible.

L’intégration suit la documentation officielle [Images et vision](https://developers.openai.com/api/docs/guides/images-vision) et [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Les tests simulent le fournisseur : ils vérifient la calibration et les erreurs, pas la précision botanique ou visuelle du modèle.

## Marge de retard d’arrosage

La fiche et l’écran « À faire » affichent une **marge indicative en heures**, une date limite indicative et l’état du retard. Le calcul utilise l’intervalle contextualisé (pot, substrat, température, exposition, cycle), multiplié par un coefficient de profil : 10 % pour les plantes à besoin d’humidité fréquent, 15 % pour les orchidées reconnues, 20 % pour les plantes vertes reconnues, 30 % pour les succulentes reconnues. Le résultat est arrondi à l’heure inférieure et plafonné à 72 heures. Ces coefficients sont des heuristiques produit non validées expérimentalement.

- Un dernier arrosage connu, le calcul automatique, un profil reconnu et un drainage confirmé sont nécessaires. Les anciennes fiches manuelles restent compatibles, sans marge inventée.
- À partir de 35 °C, aucune marge supplémentaire n’est proposée. À 5 °C ou moins, le calcul est indisponible.
- Une observation fraîche « terreau sec » annule la marge et demande une vérification immédiate. « Terreau humide » reporte la vérification selon la règle existante, sans prédire une tolérance à la sécheresse. Ces observations expirent au bout de 24 heures.
- Une confirmation d’arrosage recalcule l’échéance et la marge. Les rappels quotidiens commencent toujours à l’échéance normale : la marge ne les retarde pas et n’augmente jamais la dose.

La marge aide à prioriser les vérifications ; elle ne prédit ni la survie ni l’état réel de la plante. Vérifiez le terreau et les signes de stress.

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
- Mode local persistant, import vers un compte et suppression des plantes avec confirmation.
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

Les notifications sont regroupées par jour et programmées pour les **30 prochains jours calendaires**, puis renouvelées à chaque ouverture, retour au premier plan, changement d’heure de rappel et modification du carnet. Une heure déjà passée commence au lendemain. L’heure suit le fuseau local au moment de la programmation : rouvrez l’application après un voyage. Au passage à l’heure d’été, une heure inexistante est décalée vers l’heure valide suivante, puis l’heure habituelle reprend le lendemain. Après plus de 30 jours sans ouverture, les rappels cessent. Les échéances de rempotage sont affichées dans le carnet, sans notification dédiée. La personne référente est une simple note ; aucune invitation ni délégation distante n’est envoyée.

En mode local, les fiches et photos restent sur l’appareil, sans synchronisation. En mode compte, elles sont stockées sur le serveur Folia et retrouvées à la connexion ; les modifications des autres appareils sont récupérées par rechargement explicite. Les photos scannées transitent toutefois par plant.id pour l’identification. Désinstaller l’application ou effacer ses données supprime le carnet local, mais pas la collection du compte sur le serveur. Les anciennes photos ne sont pas encore nettoyées du stockage lors de la suppression d’une fiche.

## Structure

```text
App.tsx                 Écrans et sauvegarde locale ou liée au compte
src/AccountScreen.tsx   Inscription et connexion
src/accountApi.ts       Client des comptes et import local
src/model.ts            Modèle de données, échéances et historique
src/notifications.ts    Autorisation et programmation native des rappels
src/reminders.ts        Regroupement, remplacement et nettoyage des relances
src/plantApi.ts         Appel du serveur d’identification depuis le téléphone
src/care.ts             Valeurs d’entretien et estimation d’eau
src/irrigation.ts       Calcul contextualisé et observations d’humidité
src/tolerance.ts        Marge de retard indicative et états d’urgence
src/measurement.ts      Géométrie calibrée, coordonnées et validation
src/DimensionMeasure.tsx Mesure photo et correction visuelle des points
server/measurement.mjs  Analyse des repères par vision, clé côté serveur
src/weather.ts          Géocodage et température extérieure Open-Meteo
server.mjs              API des comptes et proxy vers plant.id
server/accounts.mjs     SQLite, mots de passe, sessions et collections privées
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

### Navigation web et personne de confiance

Sur ordinateur, les textes sont agrandis à partir de 860 px de largeur. Chaque écran possède une adresse : `#/`, `#/a-faire`, `#/mon-espace`, `#/personne-de-confiance`, `#/compte`, `#/plantes/ajouter`, `#/plantes/<id>` et `#/plantes/<id>/modifier`. Les boutons précédent/suivant du navigateur et le rechargement conservent la page demandée. Hors des champs de saisie, **Ctrl+Z** (ou **Cmd+Z**) revient à l’accueil ; dans un champ, il continue d’annuler la saisie.

La page **Personne de confiance** permet d’enregistrer un nom, un téléphone, un e-mail et des consignes pour toute la collection. Ces informations suivent la sauvegarde locale ou celle du compte connecté et sont accessibles depuis les fiches plantes. Elles n’envoient aucun message et ne donnent pas accès au compte.

### Plan 2D du logement et exposition

Ouvrez **Ma maison** (`#/ma-maison`) :

1. Renseignez les dimensions totales en mètres, l’étage, le mois étudié et l’orientation du haut du plan (0° = nord, 90° = est). Ajoutez la latitude, ou reprenez celle de la ville choisie dans **Mon espace**.
2. Choisissez **Dessiner une pièce** ou **Dessiner un jardin**, puis cliquez-glissez sur le plan pour tracer une zone rectangulaire. Un aperçu affiche ses dimensions ; relâchez pour la créer. Le tracé s’aligne tous les 10 cm, dans les deux sens ; Échap annule le geste. Vous pouvez tracer plusieurs zones avec le même outil, puis choisir **Sélectionner** pour modifier leur nom, position et dimensions. Les formulaires de coordonnées restent disponibles. Les zones doivent rester dans le plan sans se chevaucher.
3. Ajoutez les fenêtres extérieures sur le mur approprié, leur largeur, leur position et leur hauteur au-dessus du sol. Renseignez voilages et obstacles extérieurs ; pour le jardin, choisissez l’ombrage.
4. Sélectionnez une plante et placez son pin sur le plan, ou saisissez ses coordonnées. Indiquez la hauteur du feuillage.
5. Cliquez sur **Enregistrer le plan et les emplacements**. Le plan et les pins suivent la sauvegarde locale ou le compte ; les pièces, intérieur/extérieur et expositions calculables sont mis à jour ensemble. Déplacer ou supprimer une zone peut retirer les pins devenus invalides. Retirer un pin conserve les derniers paramètres d’entretien, qui restent modifiables dans la fiche.

Un plan **JPEG, PNG ou WebP** (environ 3 Mo maximum) peut être importé en fond ; il est ajusté aux dimensions saisies, puis doit être retracé. Cette version ne reconnaît pas automatiquement les murs et n’importe pas directement les PDF : exportez la page en image. Un seul niveau est représenté par plan.

Le placement est également proposé pendant l’ajout ou la modification d’une plante. Sa fiche affiche ensuite l’estimation et ses explications. Les champs d’entretien restent modifiables ; enregistrer à nouveau la maison recalcule les paramètres des plantes placées.

Le calcul solaire simplifié échantillonne toutes les 15 minutes une journée représentative (le 21 du mois choisi), en heures solaires. Les rayons passent uniquement par les fenêtres déclarées dans la pièce de la plante et tiennent compte de la hauteur du feuillage. Les voilages bloquent le soleil direct dans le modèle ; l’ombrage partiel est un facteur forfaitaire. La lumière diffuse est un indice basé sur la surface vitrée, la distance et les filtres déclarés, pas une mesure en lux. Météo, reflets, mobilier, portes ouvertes et géométrie des obstacles extérieurs ne sont pas simulés. L’étage n’est pas utilisé pour inventer une correction de lumière.

Le **score de compatibilité lumière /100** est une heuristique explicable, pas une probabilité de survie. La confiance reste faible ou moyenne. Sans latitude ou sans fenêtre renseignée dans une pièce, aucun score solaire n’est donné. Les profils initiaux couvrent Monstera, Phalaenopsis, Aloe, Echeveria, Anthurium et Ficus benjamina ; pour une autre espèce, le besoin peut être choisi manuellement. La résistance au gel et les autres exigences d’une plante de jardin ne font pas partie de ce score.

Sources des profils : [Monstera — RHS](https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants), [Phalaenopsis — RHS](https://www.rhs.org.uk/plants/12596/phalaenopsis/details), [Plantes pour pièces ensoleillées — RHS](https://www.rhs.org.uk/plants/types/houseplants/houseplants-for-sunny-rooms).

Lors de l’import de la collection locale vers un compte, le plan local est aussi repris si le compte n’en possède pas. Si les plans diffèrent, le plan du compte reste conservé et les nouvelles plantes importées doivent être replacées ; la copie locale reste intacte.
