# Récapitulatif des API et services — Phytolie

> État vérifié le **22 octobre 2026** à partir du code présent dans le dépôt, du
> fichier `.env.example` et des issues ouvertes/fermées de
> [NathanMuzay/Phytolie](https://github.com/NathanMuzay/Phytolie/issues).

## Synthèse

| Service | État | Usage dans Phytolie | Clé nécessaire | Coût à prévoir |
|---|---|---|---|---|
| API HTTP Folia (`server/`) | Utilisée | Comptes, jardin, délégations, proxy des services IA | Non | Pas de coût fournisseur ; hébergement à prévoir |
| [plant.id / Kindwise](https://www.kindwise.com/plant-id) | Utilisée | Identification d’une plante à partir d’une photo, suggestions, taxonomie, arrosage et image de référence | `PLANT_ID_API_KEY` | Crédits/plan Kindwise ; montant non confirmé publiquement |
| [OpenAI Responses API](https://developers.openai.com/api/docs/pricing) | Utilisée facultativement | Détection des points nécessaires à la mesure calibrée sur photo | `OPENAI_API_KEY` | Facturation au volume de tokens ; modèle actuel `gpt-4.1` |
| [Open-Meteo Geocoding](https://open-meteo.com/) | Utilisée | Recherche d’une ville | Non | Gratuit pour usage non commercial, limité à 10 000 appels/jour |
| [Open-Meteo Forecast](https://open-meteo.com/) | Utilisée | Température actuelle utilisée par les règles d’arrosage | Non | Même condition ; attribution obligatoire |
| Expo Notifications locales | Utilisée | Rappels d’arrosage programmés sur l’appareil | Permission système | Pas d’API payante utilisée |
| Expo ImagePicker / LightSensor | Utilisée | Galerie/caméra et mesure facultative de lumière | Permission système | Pas d’API payante utilisée |
| SQLite local | Utilisée | Comptes, collection et historique sur le serveur de développement | Non | Pas de service SaaS ; stockage et sauvegardes à gérer |

Les appels externes ne sont pas effectués directement depuis l’application mobile
pour les services secrets : l’application appelle l’API Folia, qui garde les clés
dans `.env` côté serveur. La météo est l’exception : elle est appelée depuis
`src/services/weather.ts` sans secret.

## API déjà utilisées

### 1. API HTTP interne Folia

Ce n’est pas un prestataire externe. Le serveur Node de
[`server/index.mjs`](../server/index.mjs) expose notamment :

- `/auth/register`, `/auth/login`, `/auth/logout` ;
- `/garden` pour la collection ;
- `/delegations` pour les gardiens ;
- `/identify` comme proxy authentifié vers plant.id ;
- `/measure` comme proxy authentifié vers OpenAI ;
- `/health` pour vérifier la configuration plant.id.

Les données sont actuellement stockées dans SQLite (`FOLIA_DB_PATH`, par défaut
`data/folia.sqlite`). Il n’y a donc pas encore de coût de base de données ou de
stockage cloud, mais un déploiement de production devra budgéter l’hébergement,
les sauvegardes, le stockage des photos et éventuellement la bande passante.

### 2. plant.id / Kindwise

**Fonctionnalité couverte :** identification photo dans le parcours d’ajout ou
de modification d’une plante.

Le module [`server/identification.mjs`](../server/identification.mjs) :

- normalise la photo, supprime ses métadonnées et la redimensionne ;
- envoie une image encodée en base64 à
  `https://api.plant.id/v3/identification` ;
- demande les noms communs, la taxonomie, l’arrosage, la description et une
  image de référence en français ;
- restitue plusieurs suggestions et leur confiance ;
- gère les erreurs de clé, crédits épuisés, quota, image illisible et timeout.

La clé est `PLANT_ID_API_KEY` et doit rester côté serveur. L’application ne
consomme pas de crédit si le serveur n’est pas joignable : elle vérifie d’abord
`/health`.

**Prix :** plant.id fonctionne avec les crédits et les offres Kindwise. La page
publique consultée ne fournit pas une grille tarifaire stable exploitable pour
ce document ; le montant dépend donc du plan et du nombre d’identifications
acheté dans le compte Kindwise. Le prix exact doit être relevé dans
[admin.kindwise.com](https://admin.kindwise.com/) avant la mise en production.
Le code prévoit déjà les cas HTTP `402` et `429`, mais le suivi de consommation
reste à terminer.

**Issues liées :**

- Livrées : [#74](https://github.com/NathanMuzay/Phytolie/issues/74),
  [#73](https://github.com/NathanMuzay/Phytolie/issues/73),
  [#72](https://github.com/NathanMuzay/Phytolie/issues/72),
  [#71](https://github.com/NathanMuzay/Phytolie/issues/71).
- À compléter : évaluation de la qualité et des limites dans
  [#79](https://github.com/NathanMuzay/Phytolie/issues/79), puis évolution vers
  le diagnostic santé dans [#114](https://github.com/NathanMuzay/Phytolie/issues/114).

### 3. OpenAI Responses API — vision

**Fonctionnalité couverte :** détection automatique de huit points sur une photo
de plante et de repère gradué. La géométrie et le calcul des dimensions restent
locaux et vérifiables par l’utilisateur ; OpenAI ne fournit que les points.

Le module [`server/measurement.mjs`](../server/measurement.mjs) appelle
`https://api.openai.com/v1/responses` avec :

- `OPENAI_API_KEY` côté serveur uniquement ;
- `OPENAI_VISION_MODEL`, par défaut `gpt-4.1` ;
- une image et les dimensions du repère ;
- une sortie JSON structurée et validée ;
- `store: false` ;
- une limite de 20 mesures par adresse réseau sur 15 minutes.

Le mode manuel reste disponible sans clé, sans réseau et sans IA.

**Prix OpenAI publiés au 22/10/2026 — API standard, par 1 million de tokens :**

| Modèle | Entrée | Sortie | Entrée mise en cache |
|---|---:|---:|---:|
| `gpt-4.1` (modèle utilisé) | 2,00 $ | 8,00 $ | 0,50 $ |
| `gpt-4.1-mini` | 0,40 $ | 1,60 $ | 0,10 $ |
| `gpt-4.1-nano` | 0,10 $ | 0,40 $ | 0,025 $ |

Une mesure n’a pas un prix fixe : le coût dépend notamment de la taille et du
niveau de détail de l’image, des tokens d’entrée et de la réponse. La tâche
[PHY-057 / #57](https://github.com/NathanMuzay/Phytolie/issues/57) doit donc
enregistrer le modèle, le nombre de requêtes, les tokens et le coût estimé.
La tâche [#158](https://github.com/NathanMuzay/Phytolie/issues/158) doit
mesurer la performance, la consommation et le coût avant livraison.

**Issues liées :**

- Livrées : [#76](https://github.com/NathanMuzay/Phytolie/issues/76),
  [#75](https://github.com/NathanMuzay/Phytolie/issues/75).
- À compléter : seuils de qualité [#79](https://github.com/NathanMuzay/Phytolie/issues/79),
  gestion des indisponibilités [#147](https://github.com/NathanMuzay/Phytolie/issues/147),
  logs et erreurs [#58](https://github.com/NathanMuzay/Phytolie/issues/58),
  quotas/coûts [#57](https://github.com/NathanMuzay/Phytolie/issues/57).

### 4. Open-Meteo : géocodage et météo

Le fichier [`src/services/weather.ts`](../src/services/weather.ts) utilise deux
endpoints publics :

- `geocoding-api.open-meteo.com/v1/search` pour trouver jusqu’à cinq villes ;
- `api.open-meteo.com/v1/forecast` pour obtenir `current.temperature_2m`.

La localisation automatique n’est pas obligatoire : l’utilisateur peut saisir
une ville. La température est mise en cache trois heures ; en cas de panne,
la température intérieure saisie reste utilisable.

**Prix et conditions :** Open-Meteo indique que l’API gratuite est destinée à
l’usage non commercial, limitée à 10 000 appels par jour et sans garantie de
disponibilité. Un usage commercial ou une exigence de SLA nécessite le
Customer API, avec abonnement. Les données sont sous
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) et doivent afficher
une attribution avec un lien vers Open-Meteo. Cette attribution devra être
ajoutée dans l’interface avant une publication.

**Issues liées :** fonctionnalité livrée dans
[#83](https://github.com/NathanMuzay/Phytolie/issues/83) et gestion des données
absentes/anciennes dans [#82](https://github.com/NathanMuzay/Phytolie/issues/82).
Les règles d’arrosage qui consomment cette température restent concernées par
[#78](https://github.com/NathanMuzay/Phytolie/issues/78) et
[#80](https://github.com/NathanMuzay/Phytolie/issues/80).

### 5. Notifications et capteurs Expo

Les rappels actuels sont **locaux** : [`src/services/notifications.ts`](../src/services/notifications.ts)
programme les notifications avec `expo-notifications`, demande la permission
du téléphone et ouvre l’écran « À faire ». Aucun appel au service Expo Push,
à Firebase ou à APNs n’est actuellement réalisé par Phytolie.

De la même manière, `expo-image-picker` et `expo-sensors` accèdent aux capacités
du téléphone ; ils ne constituent pas des API cloud payantes.

Les rappels locaux couvrent notamment les issues [#124](https://github.com/NathanMuzay/Phytolie/issues/124),
[#123](https://github.com/NathanMuzay/Phytolie/issues/123),
[#125](https://github.com/NathanMuzay/Phytolie/issues/125) et
[#128](https://github.com/NathanMuzay/Phytolie/issues/128). Les tests réels
dépendent toutefois des permissions, du téléphone et des restrictions de
batterie Android.

## API ou services restant à implémenter

Le backlog décrit des besoins, mais ne choisit pas toujours un fournisseur.
Il faut éviter d’ajouter une clé ou une dépendance avant d’avoir validé le
contrat, la licence, le coût et le repli hors ligne.

| Besoin | Issues | Fonctionnalités concernées | Choix à faire |
|---|---|---|---|
| Diagnostic maladies/parasites | [#111](https://github.com/NathanMuzay/Phytolie/issues/111), [#114](https://github.com/NathanMuzay/Phytolie/issues/114), [#115](https://github.com/NathanMuzay/Phytolie/issues/115), [#116](https://github.com/NathanMuzay/Phytolie/issues/116), [#117](https://github.com/NathanMuzay/Phytolie/issues/117), [#118](https://github.com/NathanMuzay/Phytolie/issues/118), [#119](https://github.com/NathanMuzay/Phytolie/issues/119), [#120](https://github.com/NathanMuzay/Phytolie/issues/120) | Photo de santé, score d’incertitude, suivi des scans, conseils sourcés, scans réguliers | Fournisseur spécialisé ou modèle vision ; couverture, précision, coût par scan et responsabilité à évaluer |
| Scan de pièce/habitat | [#103](https://github.com/NathanMuzay/Phytolie/issues/103), [#104](https://github.com/NathanMuzay/Phytolie/issues/104), [#108](https://github.com/NathanMuzay/Phytolie/issues/108), [#109](https://github.com/NathanMuzay/Phytolie/issues/109) | Extraire lumière, humidité, température et proposer un emplacement | API vision à sélectionner, ou saisie/capteurs locaux ; ne pas réutiliser OpenAI sans validation de précision |
| Code-barres et substrats | [#93](https://github.com/NathanMuzay/Phytolie/issues/93), [#94](https://github.com/NathanMuzay/Phytolie/issues/94), [#95](https://github.com/NathanMuzay/Phytolie/issues/95), [#96](https://github.com/NathanMuzay/Phytolie/issues/96), [#97](https://github.com/NathanMuzay/Phytolie/issues/97) | Scanner un produit, identifier terreau/substrat, confirmer le produit et gérer les codes inconnus | Base de produits compatible avec la France, licence et couverture à choisir ; prévoir la saisie manuelle |
| Notifications distantes | [#135](https://github.com/NathanMuzay/Phytolie/issues/135), [#129](https://github.com/NathanMuzay/Phytolie/issues/129) | Router les rappels vers un gardien et notifier sur plusieurs appareils | Expo Push Service, FCM/APNs ou autre ; nécessite tokens, serveur de jobs, consentement, coût et gestion des échecs |
| Synchronisation et stockage cloud | [#51](https://github.com/NathanMuzay/Phytolie/issues/51), [#53](https://github.com/NathanMuzay/Phytolie/issues/53), [#56](https://github.com/NathanMuzay/Phytolie/issues/56), [#60](https://github.com/NathanMuzay/Phytolie/issues/60), [#145](https://github.com/NathanMuzay/Phytolie/issues/145), [#146](https://github.com/NathanMuzay/Phytolie/issues/146), [#179](https://github.com/NathanMuzay/Phytolie/issues/179) | Récupération de compte, multi-appareils, hors connexion, photos, conflits, sauvegarde/restauration | Choisir hébergement, base, stockage objet, authentification et stratégie de synchronisation |
| Observabilité des prestataires | [#57](https://github.com/NathanMuzay/Phytolie/issues/57), [#58](https://github.com/NathanMuzay/Phytolie/issues/58), [#59](https://github.com/NathanMuzay/Phytolie/issues/59), [#182](https://github.com/NathanMuzay/Phytolie/issues/182), [#183](https://github.com/NathanMuzay/Phytolie/issues/183) | Suivre quotas, coûts, erreurs, indisponibilités et alertes de production | Choisir logs/metrics/alerting ; ne jamais journaliser les clés ni les photos brutes |

## Recommandations de mise en production

1. **Mesurer avant de payer :** ajouter un compteur par fournisseur, modèle,
   fonctionnalité et utilisateur, avec coût estimé et réponse HTTP.
2. **Garder les replis :** identification manuelle, points de mesure manuels,
   température saisie et rappels locaux doivent rester fonctionnels lorsqu’un
   service distant est indisponible.
3. **Séparer les secrets :** conserver `PLANT_ID_API_KEY` et `OPENAI_API_KEY`
   uniquement sur le serveur ; ne jamais les préfixer par `EXPO_PUBLIC_`.
4. **Ajouter les licences :** afficher l’attribution Open-Meteo et conserver
   l’attribution/licence des images botaniques renvoyées par plant.id.
5. **Définir les limites :** quotas par compte et par adresse, taille maximale
   des photos, timeout, rétention et suppression ; compléter
   [#57](https://github.com/NathanMuzay/Phytolie/issues/57) et
   [#140](https://github.com/NathanMuzay/Phytolie/issues/140).
6. **Protéger la production :** le durcissement décrit dans
   [SECURITY.md](../SECURITY.md) ajoute une liste d’origines CORS exactes,
   l’obligation HTTPS derrière un proxy local en production, des quotas
   persistants, la révocation des sessions et les outils de chiffrement et de
   sauvegarde. La publication nécessite encore la configuration des clés,
   la migration des données, le déploiement du proxy et la supervision.

## Sources tarifaires et techniques

- [OpenAI API — pricing](https://developers.openai.com/api/docs/pricing)
- [Kindwise / plant.id](https://www.kindwise.com/plant-id)
- [Console Kindwise](https://admin.kindwise.com/)
- [Open-Meteo — pricing](https://open-meteo.com/en/pricing)
- [Open-Meteo — licence](https://open-meteo.com/en/licence)
- [Expo — notifications](https://docs.expo.dev/push-notifications/overview/)
- [Documentation locale d’utilisation](USAGE.md)
- [Documentation locale de développement](DEVELOPMENT.md)
