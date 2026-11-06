export const privacyNotice = {
  updatedAt: '5 novembre 2026',
  controller: 'Nathan MUZAY',
  email: 'nathan.muzay@epitech.eu',
  hosting: 'Dans le fonctionnement local documenté, l’API et sa base de données sont exécutées sur l’ordinateur qui lance Phytolie. Aucun hébergeur de production ni pays d’hébergement de production n’est renseigné à ce jour.',
};

export type DataUse = {
  id: string;
  title: string;
  purpose: string;
  data: string;
  required: string;
  recipients: string;
  retention: string;
  basis: 'service' | 'security' | 'sharing';
};
const collectionRetention = 'Conservées dans la collection du compte jusqu’à leur modification, leur suppression dans l’application ou une demande d’effacement au responsable. Aucune purge automatique des comptes inactifs n’est actuellement programmée. Les copies de sauvegarde ont une conservation distincte, à définir par le responsable.';

export const dataUses: DataUse[] = [
  {
    id: 'account', title: 'Compte et connexion',
    purpose: 'Créer votre espace privé, vous connecter et protéger l’accès à votre collection.',
    data: 'Adresse e-mail, identifiant de compte, mot de passe saisi et éléments de vérification du mot de passe (empreinte et sel). L’e-mail est normalisé en minuscules. Le serveur conserve une empreinte du mot de passe, et non son texte original.',
    required: 'L’e-mail et le mot de passe sont nécessaires pour créer un compte et gérer sa propre collection en ligne. Un destinataire peut accéder aux plantes confiées avec le lien secret, sans compte. Ils ne servent pas à envoyer des publicités. La récupération de mot de passe par e-mail n’est pas disponible dans cette version.',
    recipients: 'API Phytolie et responsable de son exploitation. Les données de connexion ne sont pas incluses dans les requêtes envoyées à plant.id, OpenAI ou Open-Meteo.',
    retention: 'Le compte et les éléments de vérification sont conservés jusqu’au traitement d’une demande d’effacement. Aucun effacement automatique pour inactivité n’est implémenté.', basis: 'service',
  },
  {
    id: 'session', title: 'Session et identifiants techniques',
    purpose: 'Reconnaître votre connexion et autoriser les opérations sur votre compte.',
    data: 'Jeton de session aléatoire, empreinte de ce jeton sur le serveur, identifiant de compte, date d’expiration et numéro de version de la collection pour éviter les écrasements entre appareils. Le jeton est gardé en mémoire dans l’application, sans enregistrement permanent par Phytolie sur l’appareil.',
    required: 'Créés automatiquement à la connexion. Sans session valide, l’accès à la collection en ligne est refusé.',
    recipients: 'Application et API Phytolie. Le jeton sert à authentifier les requêtes et n’est pas transmis aux fournisseurs d’identification, de mesure ou de météo.',
    retention: 'Session valable au maximum 24 heures. La déconnexion révoque la session ; les empreintes expirées sont purgées lors de la création d’une nouvelle session. Le serveur limite à cinq les sessions conservées par compte.', basis: 'service',
  },
  {
    id: 'plants', title: 'Identité et fiches de vos plantes',
    purpose: 'Afficher votre herbier, retrouver une plante et proposer ses repères d’entretien.',
    data: 'Identifiant, surnom, espèce, famille, description, nom de pièce, date de création, provenance de l’identification, score de confiance et conseils reçus de plant.id. Les résultats d’identification peuvent être corrigés dans la fiche.',
    required: 'Le nom est requis à la saisie. Des valeurs de départ sont proposées pour compléter les fiches. L’identification par photo reste facultative.',
    recipients: 'Votre appareil et l’API Phytolie. Les fiches des plantes confiées deviennent accessibles à la personne invitée pendant la période autorisée.',
    retention: collectionRetention, basis: 'service',
  },
  {
    id: 'photos', title: 'Photos et choix du visuel',
    purpose: 'Illustrer une fiche, identifier une plante et, à votre demande, repérer des points de mesure sur sa photo.',
    data: 'Image choisie ou prise avec la caméra, contenu et éventuelles métadonnées du fichier, mode photo personnelle ou visuel botanique, cadrage, URL et attribution d’une image de référence (auteur, licence et lien de licence). Une photo peut contenir des personnes, des documents ou des éléments de votre logement : choisissez une image centrée sur la plante.',
    required: 'Facultatives. La saisie manuelle permet de créer une fiche sans photo. Dans le parcours actuel, choisir ou prendre une photo déclenche une tentative d’identification par plant.id. Le bouton de détection automatique des dimensions déclenche séparément l’envoi à OpenAI.',
    recipients: 'L’API Phytolie reçoit la photo pour l’analyse et la conserve avec la fiche si vous enregistrez celle-ci. plant.id / Kindwise reçoit la photo préparée pour l’identification. OpenAI reçoit la photo pour la mesure IA uniquement lorsque vous lancez cette détection. Une personne invitée peut voir les photos des plantes confiées. Une image de référence distante est chargée depuis son hébergeur, qui reçoit alors les informations techniques de connexion de votre appareil.',
    retention: 'Dans Phytolie : conservation avec la fiche et, sur mobile, des fichiers locaux peuvent subsister jusqu’à l’effacement des données de l’application. Les traitements et copies chez les fournisseurs suivent leurs conditions : supprimer une fiche ne déclenche pas automatiquement une suppression chez eux. Aucune durée fournisseur ni rétention nulle n’est garantie par cette application.', basis: 'service',
  },
  {
    id: 'care', title: 'Dimensions, environnement et calculs d’entretien',
    purpose: 'Calculer les dates de vérification, les doses indicatives et les explications affichées dans la fiche.',
    data: 'Hauteur et largeur de la plante ; diamètre, profondeur, matériau et drainage du pot ; terreau conseillé et rétention du substrat réel ; température ; intérieur ou extérieur ; exposition ; croissance ou repos ; calcul automatique ou manuel ; intervalle et dose manuels ; observation de terreau sec ou humide et sa date ; date de contrôle du rempotage.',
    required: 'Les valeurs utiles au calcul sont renseignées ou préremplies. La largeur et les observations sont facultatives. Vous pouvez modifier les valeurs et conserver un réglage manuel.',
    recipients: 'Calculs réalisés dans l’application ; données sauvegardées dans la collection sur l’API Phytolie. Les informations de la plante confiée sont accessibles à l’invité pendant son accès.',
    retention: collectionRetention, basis: 'service',
  },
  {
    id: 'measurements', title: 'Mesures sur photo et lumière',
    purpose: 'Estimer les dimensions avec un repère et conserver un relevé de luminosité à l’emplacement de la plante.',
    data: 'Photo, dimensions de l’image, description et longueur du repère, points placés ou détectés, dimensions calculées, méthode et date de mesure. Pour la lumière : lux, date, pièce, capteur ou saisie manuelle, rideaux fermés et éclairage artificiel. Les points de travail et la description du repère ne sont pas enregistrés dans la fiche ; le résultat de mesure et le dernier relevé peuvent l’être.',
    required: 'Facultatives. Vous pouvez placer les points et saisir les lux manuellement. Le capteur lumineux est utilisé pendant la mesure, sans collecte continue.',
    recipients: 'Traitement manuel et capteur dans votre appareil. En détection IA : photo, dimensions de l’image, description et longueur du repère passent par l’API Phytolie vers OpenAI. Le résultat enregistré est sauvegardé dans la collection.',
    retention: 'Le dernier résultat de mesure et le dernier relevé conservés dans une fiche restent jusqu’à leur remplacement ou leur retrait. Les relevés bruts du capteur et les points de travail restent temporaires dans l’interface. Les copies éventuelles du fournisseur IA dépendent de ses conditions.', basis: 'service',
  },
  {
    id: 'history', title: 'Arrosages et historique',
    purpose: 'Calculer les prochaines échéances à partir des soins confirmés et retrouver les opérations effectuées.',
    data: 'Date du dernier arrosage ; dates et heures des soins, quantité réellement versée facultative, notes, identifiants et dates d’enregistrement, correction et annulation. Rempotages : dimensions des anciens et nouveaux pots, substrat choisi avec nom, composition, profil de rétention, provenance et référence produit facultative. Changements de substrat : ancienne et nouvelle description. Date d’archivage de la plante. Pour les soins délégués : identifiants de l’accès et de la plante, date d’arrosage et e-mail du destinataire indiqué par le propriétaire. Un arrosage par lien est identifié comme tel, sans identité authentifiée ; les anciens accès acceptés peuvent rester rattachés à un compte invité.',
    required: 'Le dernier arrosage connu est facultatif à l’ajout. Une confirmation enregistre sa date ; quantité et note sont facultatives. Le rempotage demande le pot, le substrat et une prochaine date de contrôle. Les actions par lien sont attribuées à l’accès partagé, sans preuve de l’identité de son utilisateur.',
    recipients: 'Votre compte et API Phytolie. Le destinataire du lien voit le dernier arrosage, pas les notes et le journal privés de la plante. Le propriétaire consulte les confirmations de l’accès invité.',
    retention: 'La fiche conserve jusqu’à 500 événements de soin ; au-delà, un nouvel ajout est refusé sans effacer l’historique. Les 100 derniers arrosages actifs alimentent aussi les anciens champs de compatibilité. Une annulation reste visible dans le journal et ne compte plus dans les échéances. L’archivage conserve la fiche et suspend ses rappels et son accès par les invités ; la restauration réactive ces fonctions selon vos réglages et invitations encore valides. Supprimer la plante retire son journal de la collection active. Le journal serveur des actions déléguées a une conservation distincte : aucune purge automatique n’est actuellement programmée.', basis: 'sharing',
  },
  {
    id: 'home', title: 'Plan de maison et emplacements',
    purpose: 'Placer vos plantes et estimer la lumière selon les pièces et ouvertures déclarées.',
    data: 'Image de plan importée ; dimensions du logement ; noms, formes, positions et dimensions des pièces et jardins ; murs, portes et fenêtres ; orientation, étage, mois et latitude ; ombrage, obstacles et filtres ; position et hauteur d’une plante, besoin lumineux choisi.',
    required: 'Facultatives pour utiliser le carnet. Une estimation solaire nécessite les renseignements correspondants, dont les fenêtres et la latitude. Aucun relevé automatique du domicile n’est réalisé.',
    recipients: 'Votre appareil et l’API Phytolie. Les calculs du plan sont réalisés dans l’application. Le plan complet, les coordonnées des plantes sur ce plan et la note personnelle de référent sont exclus de la collection transmise à un invité.',
    retention: collectionRetention, basis: 'service',
  },
  {
    id: 'weather', title: 'Ville et météo',
    purpose: 'Rechercher une ville et adapter la température utilisée pour les plantes déclarées à l’extérieur.',
    data: 'Texte saisi dans la recherche de ville ; ville choisie avec identifiant, nom, région, pays, latitude et longitude ; température extérieure et heure de récupération. Aucune permission GPS n’est demandée pour cette fonction.',
    required: 'Facultatives. Sans ville ou si la météo échoue, la température saisie dans la fiche reste utilisée.',
    recipients: 'La recherche est envoyée directement au géocodage Open-Meteo. Les coordonnées de la ville choisie sont envoyées au service météo Open-Meteo. Ce service reçoit l’adresse IP et les informations techniques de la requête. La ville choisie est sauvegardée dans votre collection Phytolie ; les mots recherchés n’y sont pas enregistrés.',
    retention: 'Ville conservée jusqu’à sa modification ou la désactivation de la météo. Température gardée en mémoire dans l’application, actualisée périodiquement et utilisée au maximum pendant trois heures après récupération. La conservation technique chez Open-Meteo est décrite dans sa politique.', basis: 'service',
  },
  {
    id: 'sharing', title: 'Personne de confiance et invitations',
    purpose: 'Conserver un contact et lui donner un accès temporaire aux plantes choisies.',
    data: 'Nom, téléphone, e-mail et consignes du contact ; note de référent par plante ; e-mail du destinataire indiqué par le propriétaire, plantes sélectionnées, consignes, début et fin d’accès, état de l’accès et identifiant propriétaire. Les anciens accès acceptés restent associés à un compte invité. Le code secret d’invitation est conservé sous forme d’empreinte sur le serveur.',
    required: 'Fonction facultative. L’e-mail du destinataire, les plantes et les dates sont nécessaires à la création d’un accès. L’e-mail sert de repère au propriétaire ; aucun compte ni vérification de cet e-mail n’est exigé à l’ouverture du lien. Le téléphone n’est pas obligatoire. Informez le contact dont vous renseignez les coordonnées et évitez les informations sans rapport avec les soins.',
    recipients: 'Votre compte et l’API Phytolie. Toute personne possédant le lien secret accède, sans connexion, aux données d’entretien et photos des plantes sélectionnées, aux consignes et à l’e-mail du propriétaire pendant la période prévue. Le plan, les coordonnées du contact, les mesures, notes et journaux privés sont exclus de cet espace. Aucun e-mail d’invitation n’est envoyé automatiquement : vous partagez vous-même le lien ou le code.',
    retention: 'Nouveau lien réutilisable jusqu’à la fin de la période choisie, limitée à 90 jours et révocable immédiatement. Les anciens liens non consommés gardent leur expiration d’origine à leur conversion. L’expiration ferme l’accès mais n’efface pas automatiquement l’invitation, ses consignes ou les traces d’actions. Leur purge doit être définie par le responsable.', basis: 'sharing',
  },
  {
    id: 'reminders', title: 'Rappels et notifications',
    purpose: 'Programmer et afficher les rappels locaux d’entretien à l’heure choisie.',
    data: 'Activation des rappels, heure choisie, autorisation système, noms et identifiants des plantes concernées, dates programmées et identifiants des notifications.',
    required: 'Facultatifs et désactivables. L’autorisation du téléphone est nécessaire pour afficher les notifications. Leur contenu peut être visible sur l’écran verrouillé selon vos réglages système.',
    recipients: 'Réglage d’heure et activation dans votre compte ; programmation et affichage par votre appareil. Phytolie utilise des notifications locales et ne demande pas de jeton de notification push distant.',
    retention: 'Réglages conservés jusqu’à modification. Notifications programmées sur 30 jours, remplacées lors des mises à jour et annulées lorsque les rappels sont désactivés ou à la déconnexion. Le système peut conserver les notifications déjà affichées jusqu’à leur effacement.', basis: 'service',
  },
  {
    id: 'local', title: 'Affichage et ancien carnet local',
    purpose: 'Conserver vos préférences de lecture et permettre un import volontaire d’un ancien carnet.',
    data: 'Taille du texte, contraste renforcé, police simple, espacement et réduction des animations ; préférence système d’animation à l’initialisation ; ancien carnet et anciens fichiers photo présents sur l’appareil ; texte recherché dans cette notice pour filtrer les catégories affichées.',
    required: 'Préférences facultatives. L’ancien carnet n’est importé dans le compte que sur votre action « Importer mes plantes locales ».',
    recipients: 'Préférences conservées sur l’appareil (stockage local du navigateur sur le web), sans transmission à l’API. L’import choisi copie les plantes et photos nécessaires vers votre compte. La copie locale est conservée. La recherche dans cette notice reste dans la mémoire de l’écran, sans envoi à un serveur.',
    retention: 'Préférences jusqu’à réinitialisation ou effacement du stockage de l’application. Ancien carnet et fichiers locaux jusqu’à leur effacement sur l’appareil. La déconnexion n’efface pas automatiquement ces données locales.', basis: 'service',
  },
  {
    id: 'security', title: 'Sécurité, quotas et journaux techniques',
    purpose: 'Limiter les tentatives de connexion, protéger les comptes, maîtriser les appels externes et diagnostiquer les incidents.',
    data: 'Adresse IP reçue lors des requêtes puis pseudonymisée dans les compteurs et journaux applicatifs ; identifiant de compte ; identifiant et date de requête, route technique, méthode, statut HTTP et durée. Les compteurs de connexion peuvent utiliser une empreinte de l’adresse e-mail. Le code ne journalise pas les corps des requêtes, les mots de passe, les jetons ni les photos.',
    required: 'Traitements techniques nécessaires à la protection du service. Une empreinte reste une donnée pseudonymisée, et non une anonymisation garantie.',
    recipients: 'API Phytolie et personnes habilitées à son exploitation. Un hébergeur ou proxy peut disposer de ses propres journaux de connexion. En mode démonstration, les flux transitent aussi par Expo/ngrok.',
    retention: 'Compteurs par fenêtres d’une minute, de 15 minutes ou de 24 heures selon la limite ; les compteurs expirés sont nettoyés lors d’une requête ultérieure. La conservation des journaux et sauvegardes est à définir par le responsable : aucune durée automatique n’est imposée par le code actuel.', basis: 'security',
  },
];

export const privacyBases = {
  service: 'Exécution du service demandé (article 6, paragraphe 1, b du RGPD).',
  security: 'Intérêt légitime à sécuriser le service et prévenir les abus (article 6, paragraphe 1, f du RGPD).',
  sharing: 'Exécution du service demandé pour les comptes concernés ; intérêt légitime à organiser les soins pour les coordonnées de tiers, sous réserve de leurs droits (article 6, paragraphe 1, b et f du RGPD).',
};
