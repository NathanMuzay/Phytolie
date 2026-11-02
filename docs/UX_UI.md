# Phytolie — UX/UI web et mobile

La refonte est intégrée à l’application React Native / Expo et à sa version web. Elle conserve l’identité botanique et réorganise les parcours principaux autour de trois objectifs : retrouver une plante, savoir quoi vérifier aujourd’hui et ajouter une fiche sans affronter tous les réglages d’un coup.

## Référence de conception

Le programme et les ressources textuelles de la [formation Figma de Digidop](https://academie.digidop.fr/formations/figma) ont servi de cadre, en particulier [les principes UX, UI et accessibilité](https://academie.digidop.fr/formations/figma/0-0-principes-du-webdesign) et [le design system](https://academie.digidop.fr/formations/figma/0-0-design-system). L’application de ces principes se fait ici dans les composants du produit. Aucun fichier Figma n’a été créé et les vidéos ne sont pas présentées comme ayant été suivies intégralement.

## Décisions appliquées

| Constat dans l’application | Changement | Intérêt pour l’utilisateur |
| --- | --- | --- |
| Les pages principales étaient cachées dans le menu mobile. | Navigation persistante vers plantes, soins et maison ; menu Plus pour les autres pages. | Passer d’un usage quotidien à l’autre en une action. |
| L’herbier n’avait ni recherche ni filtres. | Recherche insensible aux accents, filtres combinables par pièce et soins du jour, tri par urgence ou nom. | Retrouver une plante lorsque la collection grandit. |
| Le résumé web des soins n’ouvrait pas les tâches. | Résumé actionnable sur toutes les tailles d’écran. | Accéder directement aux plantes à vérifier. |
| L’ajout présentait un formulaire continu très long. | Trois étapes avec progression, validation avant de continuer, retour conservant les valeurs et récapitulatif avant sauvegarde. | Renseigner une catégorie d’informations à la fois. |
| Le premier écran expliquait peu la valeur de l’application. | Connexion avec présentation sur ordinateur, formulaire compact sur mobile, onglets connexion/inscription, mot de passe affichable et validation de l’e-mail. | Comprendre le produit et réduire les erreurs de saisie. |
| La fiche mélangeait les actions, la description et les explications techniques. | Résumé du prochain soin, actions en tête, repères en cartes et sections dépliables pour les détails. | Voir le prochain geste sans parcourir toutes les explications. |
| Certains contrôles avaient des styles différents. | Bouton partagé sur connexion, collection, formulaires et soins ; palette commune actualisée. | Reconnaître les actions principales et secondaires. |
| Les confirmations restaient fixes au-dessus du contenu. | Messages défilants avec bouton de fermeture distinct. | Garder le contenu accessible avec le texte agrandi. |

## Règles visuelles et responsive

- Fond clair, cartes blanches, vert forêt pour les actions principales, sauge pour les résumés et terre cuite pour les vérifications dues. Les statuts sont aussi exprimés en texte.
- Titres à empattement et texte courant simple, espacements réguliers, boutons de 48 px minimum et filtres de 44 px minimum, hors agrandissement du texte.
- À partir de 860 px sur le web, navigation en haut et grille allant jusqu’à trois colonnes selon la place réelle. Les cartes reviennent à une colonne si nécessaire avec le texte agrandi.
- Connexion en deux colonnes à partir de 1 000 px, si l’agrandissement du texte le permet.
- Sur petit écran, navigation en bas ; à partir de 150 % de texte sur une largeur inférieure à 600 px, les entrées occupent deux lignes pour conserver leurs libellés.
- Les contrastes renforcés, la police simple, les interlignes et la réduction des animations restent disponibles. Les erreurs, sélections, étapes et boutons désactivés disposent d’indications accessibles.

## Captures

Captures du navigateur avec une collection fictive et une base de test temporaire indépendante des données utilisateur :

- [Connexion sur ordinateur](ux-ui/connexion-web.png)
- [Collection sur ordinateur](ux-ui/collection-web.png)
- [Collection sur mobile](ux-ui/collection-mobile.png)
- [Navigation mobile](ux-ui/navigation-mobile.png)
- [Soins sur mobile](ux-ui/soins-mobile.png)
- [Récapitulatif d’ajout sur mobile](ux-ui/ajout-mobile.png)
- [Fiche de plante sur ordinateur](ux-ui/fiche-web.png)
- [Fiche de plante sur mobile](ux-ui/fiche-mobile.png)

## Vérification et limites

La vérification comprend TypeScript, la suite automatisée du projet, les exports Expo web et Android, et des parcours dans Chrome sans interface avec la véritable API locale et des données fictives. Les parcours couvrent connexion au clavier, recherche avec accents, filtres combinés, navigation, ajout manuel complet, conservation des valeurs entre étapes et ouverture d’une fiche en modification. La fiche est aussi vérifiée avec ses sections repliées et dépliées, l’enregistrement d’un terreau humide, la confirmation d’un arrosage, la conservation de l’historique et l’annulation d’une suppression. Les mises en page sont contrôlées à 1 440, 390, 320 et 860 px, ainsi qu’avec un texte à 200 % et les contrastes renforcés.

L’export Android valide le bundle, pas une exécution sur un téléphone. Les interactions natives caméra, capteur, notifications et clavier demandent encore une vérification sur appareil. Cette refonte n’inclut pas d’étude terrain ; un gain d’utilisabilité mesuré demanderait des essais avec les utilisateurs.

Pour une prochaine évaluation, faire réaliser trois tâches sans aide : trouver une plante dans une pièce, noter un terreau encore humide et créer une fiche sans photo. Observer les hésitations, le taux de réussite et le temps nécessaire, puis ajuster les libellés et les étapes.
