# Guide d’utilisation

[Retour au README](../README.md) · [Développement](DEVELOPMENT.md)

## Choisir le visuel d’une plante

Dans « Ajouter une plante » ou « Modifier la fiche », choisissez **Ma photo** ou **Visuel botanique**. Après un scan, une identification avec au moins 80 % de confiance sélectionne automatiquement le visuel botanique. En dessous de ce seuil, choisissez une proposition pour déclencher le même comportement. Les illustrations locales couvrent Monstera deliciosa, Aloe vera, Ficus elastica et Nephrolepis exaltata ; pour les autres espèces, plant.id fournit une photo représentative avec son attribution et sa licence. En l’absence de photo de référence, votre photo personnelle reste affichée (ou une composition décorative si aucune photo n’est disponible). Le visuel suit l’espèce renseignée et le choix est sauvegardé avec la fiche.

La photo personnelle reste conservée lorsque vous affichez un visuel botanique. Choisissez **Photo entière** pour éviter de couper les feuilles ou **Remplir le cadre** pour un affichage recadré. Le carnet et les fiches partagent un cadre adaptatif au format 4:3. L’identification et les mesures utilisent uniquement votre photo originale. La photo de référence nécessite une connexion ; changer manuellement l’espèce efface la référence de l’ancienne espèce. Redémarrez `npm run api` après cette mise à jour pour obtenir les images dans les réponses de scan.

## Affiner la lumière (facultatif)

Dans « Ajouter une plante » ou « Modifier la fiche », choisissez **Faible lumière**, **Lumière indirecte** ou **Soleil direct** dans les paramètres d’entretien. Le bouton **Affiner avec une mesure (facultatif)** permet ensuite de compléter ce choix :

1. Sur Android compatible, placez le téléphone à l’emplacement de la plante, à hauteur des feuilles, capteur dégagé et tourné vers la lumière. Appuyez sur **Mesurer avec mon téléphone** et restez immobile quelques secondes.
2. Vérifiez les conditions (rideaux, éclairage artificiel), puis appuyez sur **Utiliser ce relevé**. Sur les autres appareils ou sans capteur disponible, saisissez la valeur d’un luxmètre. Zéro lux est accepté ; les valeurs doivent rester entre 0 et 200 000 lux.
3. Enregistrez la fiche. Le dernier relevé, sa date et son heure, son origine, la pièce et les conditions sont conservés avec la collection du compte et affichés sur la fiche. Un nouveau relevé remplace le précédent ; « Retirer le relevé » permet de le supprimer à la prochaine sauvegarde.

La mesure est entièrement facultative, sans rappels ni nouvelle configuration `.env`. Le capteur est arrêté à la fermeture de la mesure, au passage en arrière-plan ou après quelques secondes ; aucune collecte continue n’est effectuée. La précision dépend du téléphone. Le conseil utilise des repères généraux, sans seuil botanique propre à chaque espèce. Les lux ponctuels ne déterminent ni la lumière cumulée sur la journée, ni la présence de soleil direct : le choix d’exposition reste utilisé pour l’arrosage. Cette première version ne calibre pas le modèle du plan et ne couple pas le relevé au rayonnement météo.

L’accès au capteur utilise [Expo LightSensor](https://docs.expo.dev/versions/latest/sdk/light-sensor/), disponible sur Android et inclus dans Expo Go. Après mise à jour des dépendances (`npm ci`), redémarrez Expo. Une application native personnalisée doit être reconstruite pour intégrer `expo-sensors`.

## Mesurer les dimensions sur photo

Dans « Ajouter une plante » ou « Modifier la fiche », ajoutez une photo, puis ouvrez **Dimensions sur photo → Mesurer cette photo**.

1. Photographiez de face la plante entière et son pot de culture, avec une règle ou une feuille A4 placée à côté **à la même distance de l’appareil**. Le niveau du terreau et l’ouverture du pot doivent être visibles. Évitez les perspectives fortes, le grand-angle, les plantes tronquées et les cache-pots masquant le pot intérieur.
2. Décrivez le segment de référence et sa longueur réelle : par défaut, le grand côté vertical d’une feuille A4 (29,7 cm).
3. Appuyez sur **Détecter automatiquement les points**. Le serveur utilise l’API de vision OpenAI et renvoie huit points normalisés. La hauteur du terreau au sommet, la largeur du feuillage et le diamètre de l’ouverture du pot sont ensuite calculés par rapport au repère.
4. Vérifiez les points numérotés : choisissez un point puis touchez la photo pour le corriger. Vous pouvez aussi placer les huit points directement, **sans clé API, sans réseau et sans analyse IA**.
5. Appuyez sur **Appliquer les dimensions à la fiche**, puis enregistrez la plante. Les valeurs restent modifiables ; leur origine et leur date sont conservées avec la collection du compte. Modifier une dimension manuellement retire l’attribution à la mesure photo.

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

## Navigation et personne de confiance

Sur téléphone, le bouton **Menu**, en haut à côté de **Phytolie**, ouvre les six pages : Mes plantes, À faire, Ma maison, Personne de confiance, Mon espace et Paramètres. La page active est indiquée et le menu se ferme après sélection ; le bouton Retour Android ferme également le menu. L’accueil présente d’abord l’ajout d’une plante, puis les soins du jour et l’herbier. Le tri apparaît à partir de deux plantes. La collection s’actualise en revenant sur Mes plantes ; tirez aussi la liste vers le bas pour l’actualiser sur téléphone.

Sur ordinateur, les textes sont agrandis à partir de 860 px de largeur. Chaque écran possède une adresse : `#/`, `#/a-faire`, `#/mon-espace`, `#/personne-de-confiance`, `#/compte`, `#/plantes/ajouter`, `#/plantes/<id>` et `#/plantes/<id>/modifier`. Les boutons précédent/suivant du navigateur et le rechargement conservent la page demandée. Hors des champs de saisie, **Ctrl+Z** (ou **Cmd+Z**) revient à l’accueil ; dans un champ, il continue d’annuler la saisie.

La page **Personne de confiance** permet d’enregistrer un nom, un téléphone, un e-mail et des consignes, puis de créer un accès temporaire :

1. Renseignez l’adresse e-mail de la personne et les consignes. Sélectionnez les plantes à confier et les dates (format `AAAA-MM-JJ`, dernier jour inclus, dans le fuseau de votre appareil). La période est limitée à 90 jours.
2. Cliquez sur **Créer une invitation**. Sur le Web, partagez le lien affiché ; sur mobile, partagez le code. Aucun e-mail n’est envoyé automatiquement. Le lien ou code apparaît uniquement à la création ; s’il est perdu, révoquez l’invitation et créez-en une nouvelle.
3. La personne se connecte ou s’inscrit avec l’adresse prévue. Un lien Web conserve le code pendant la connexion ; sur mobile, elle colle le code dans **Accepter une invitation**. L’invitation est à usage unique et expire au bout de 7 jours ou à la fin de la période si elle arrive avant.
4. Pendant la période autorisée, **Plantes qui me sont confiées → Voir les plantes et consignes** affiche uniquement les plantes choisies, leurs échéances et les consignes. **J’ai arrosé** met à jour la collection du propriétaire. Une confirmation répétée le même jour UTC ne duplique pas l’historique. Les opérations sont attribuées au compte invité dans **Arrosages par les personnes de confiance**.
5. **Retirer cet accès** révoque immédiatement les autorisations sur le serveur. La fin de période bloque aussi les lectures et confirmations ; un espace déjà ouvert se rafraîchit toutes les 30 secondes. Le propriétaire revient dans Mes plantes (ou tire la liste vers le bas sur téléphone) pour voir les arrosages distants ; une sauvegarde obsolète est refusée.

La personne invitée ne peut ni modifier les fiches, ni supprimer les plantes, ni accéder aux réglages du propriétaire ou à son plan complet. Les invitations, leur acceptation et les arrosages sont conservés dans SQLite ; seuls les condensats des codes sont stockés. Le partage nécessite le même serveur pour les deux comptes. L’adresse e-mail des comptes n’est pas encore vérifiée : l’acceptation exige à la fois le code secret et un compte avec l’adresse prévue, sans prouver la possession de la boîte e-mail. Les anciens carnets locaux restent importables après connexion ; le mode sans compte n’est plus proposé.

## Plan 2D du logement et exposition

Sur PC, **Ma maison** (`#/ma-maison`) présente **Plan actuel** à gauche et **Plantes à placer** à droite.

1. Cliquez sur **Éditer le plan** (ou **Créer ma maison** pour un plan vide). L’éditeur occupe toute la fenêtre ; les changements restent privés à l’éditeur jusqu’à l’enregistrement.
2. Tracez une **Pièce** ou un **Jardin** par cliquer-glisser. Les zones rectangulaires doivent rester dans le plan et ne pas se chevaucher. Sélectionnez une zone pour changer son nom, sa position et ses dimensions dans le panneau de propriétés. Glissez la zone pour la déplacer ou sa poignée inférieure droite pour la redimensionner. Les plantes déjà placées suivent leur pièce.
3. Tracez un **Mur droit** ou un **Mur arrondi**. La poignée centrale règle la courbure ; les poignées des extrémités règlent le tracé. L’épaisseur et les points sont également modifiables dans les propriétés.
4. Choisissez **Porte** ou **Fenêtre**, puis cliquez près d’un mur. Les fenêtres posées sur le contour d’une pièce servent à estimer sa lumière : largeur, hauteur vitrée, bas de la fenêtre, voilage et obstacles sont réglables. Les ouvertures sur des murs libres décrivent les cloisons. Glissez une ouverture le long de son mur pour déplacer son centre ; les portes permettent d’inverser les charnières et le sens d’ouverture.
Les champs de propriétés mettent à jour le dessin dès qu’une valeur valide est saisie (point ou virgule décimale). Une valeur refusée reste visible en rouge et bloque l’enregistrement jusqu’à correction. Agrandir une ouverture ajuste son centre si nécessaire ; raccourcir un mur conserve ses ouvertures dans ses limites. Changer les dimensions globales recadre la vue. La hauteur et le bas des fenêtres sont des dimensions verticales : leur annotation apparaît près de la fenêtre sélectionnée, sans modifier sa largeur dans la vue de dessus.

5. Utilisez la molette ou **＋ / −** pour zoomer, **Déplacer la vue** pour naviguer et **Cadrer le plan** pour revenir à la vue d’ensemble. La grille est métrique ; l’aimantation tous les 10 cm peut être désactivée. **Annuler / Rétablir** conserve les 40 dernières opérations. Ctrl/Cmd Z, Maj Z ou Ctrl Y, Suppr et les flèches sont disponibles hors des champs de texte. Échap annule le geste ; Maj + flèche déplace de 1 m au lieu de 10 cm.
6. Dans **Propriétés du plan**, réglez les dimensions globales, l’orientation du nord, l’étage, le mois étudié, la latitude et le fond importé. Cliquez sur **Enregistrer et fermer** pour sauvegarder le plan et les placements avec le compte. Fermer un éditeur modifié propose de poursuivre, enregistrer ou abandonner. Une sauvegarde refusée garde les modifications dans l’éditeur.
7. Dans **Plantes à placer**, choisissez une plante puis cliquez ou glissez sur le plan pour la déposer dans une pièce ou un jardin. Un dépôt hors zone conserve l’ancien emplacement. Cliquez sur **Enregistrer le plan et les emplacements** pour sauvegarder ces déplacements. Les fiches conservent leurs photos et leur historique ; leurs pièces et environnements sont mis à jour ensemble.

Sur mobile, le dessin de zones et les formulaires de coordonnées restent disponibles dans l’interface existante. La création des murs libres, courbes et portes se fait dans l’éditeur PC. Supprimer une zone retire ses portes et ses placements ; supprimer un mur libre retire ses ouvertures. L’annulation restaure ces éléments avant l’enregistrement.

Un plan **JPEG, PNG ou WebP** (environ 3 Mo maximum) peut être importé en fond ; il est ajusté aux dimensions saisies, puis doit être retracé. Cette version ne reconnaît pas automatiquement les murs et n’importe pas directement les PDF : exportez la page en image. Un seul niveau est représenté par plan.

Le placement est également proposé pendant l’ajout ou la modification d’une plante. Sa fiche affiche ensuite l’estimation et ses explications. Les champs d’entretien restent modifiables ; enregistrer à nouveau la maison recalcule les paramètres des plantes placées.

Le calcul solaire simplifié échantillonne toutes les 15 minutes une journée représentative (le 21 du mois choisi), en heures solaires. Les rayons passent uniquement par les fenêtres déclarées dans la pièce de la plante et tiennent compte de la hauteur du feuillage. Les voilages bloquent le soleil direct dans le modèle ; l’ombrage partiel est un facteur forfaitaire. La lumière diffuse est un indice basé sur la surface vitrée, la distance et les filtres déclarés, pas une mesure en lux. Météo, reflets, mobilier, ombres des cloisons droites ou courbes, portes ouvertes et géométrie des obstacles extérieurs ne sont pas simulés. L’étage n’est pas utilisé pour inventer une correction de lumière.

Le **score de compatibilité lumière /100** est une heuristique explicable, pas une probabilité de survie. La confiance reste faible ou moyenne. Sans latitude ou sans fenêtre renseignée dans une pièce, aucun score solaire n’est donné. Les profils initiaux couvrent Monstera, Phalaenopsis, Aloe, Echeveria, Anthurium et Ficus benjamina ; pour une autre espèce, le besoin peut être choisi manuellement. La résistance au gel et les autres exigences d’une plante de jardin ne font pas partie de ce score.

Sources des profils : [Monstera — RHS](https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants), [Phalaenopsis — RHS](https://www.rhs.org.uk/plants/12596/phalaenopsis/details), [Plantes pour pièces ensoleillées — RHS](https://www.rhs.org.uk/plants/types/houseplants/houseplants-for-sunny-rooms).

Lors de l’import de la collection locale vers un compte, le plan local est aussi repris si le compte n’en possède pas. Si les plans diffèrent, le plan du compte reste conservé et les nouvelles plantes importées doivent être replacées ; la copie locale reste intacte.

**Plus de détails** donne accès à la fiche de la plante choisie (nom, espèce, dimensions, pot, température, terreau, emplacement et besoin lumineux). Sur mobile, les propriétés des pièces, fenêtres et jardins restent accessibles dans cette section. Les coordonnées de placement restent facultatives, derrière **Utiliser les coordonnées**.

## Paramètres et lisibilité

L’onglet **Paramètres** (`#/parametres`), également accessible depuis la connexion, règle la taille du texte (100 à 200 %), le contraste renforcé, la police sans empattement, les interlignes et la réduction des animations. L’aperçu et les pages se mettent à jour immédiatement. Les préférences sont enregistrées séparément de la collection sur cet appareil et conservées lors des changements de compte. À la première ouverture, la réduction des animations reprend le réglage système. Le bouton de réinitialisation rétablit les valeurs par défaut. Le clavier affiche un contour de focus visible sur le Web ; les onglets défilent horizontalement sur petit écran. La palette associe terracotta (`#B96D4F`), sauge (`#A8B49A`) et vert forêt (`#2F4033`) sur des fonds ivoire ; le mode contraste renforcé reste disponible.
