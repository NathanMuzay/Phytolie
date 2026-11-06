# Sécurité de Phytolie

État du durcissement : **22 octobre 2026**. Ce document décrit le code livré,
les réglages à activer, les vérifications et les risques restants. Il ne constitue
ni une certification ni une garantie d’absence de vulnérabilités.

## 1. État réel et périmètre

Le projet dispose désormais d’une couche de sécurité serveur dédiée, de quotas
SQLite persistants, d’un chiffrement applicatif des jardins et des consignes,
de sauvegardes chiffrées et de fonctions de révocation des sessions.

**Le chiffrement de la base existante n’a pas été exécuté pendant ce travail.**
Aucune clé de production n’a été générée dans le dépôt, aucun service n’a été
publié et aucun pare-feu de la machine n’a été modifié. Le démarrage en production
refuse les clés absentes, les données sensibles non migrées et une exposition
directe de l’API sur une interface publique.

| Protection | État |
|---|---|
| Authentification, droits par propriétaire et délégation | Active sur les routes privées |
| Hachage des mots de passe et des jetons | Actif |
| Quotas par IP, compte et fournisseur | Actifs ; persistance après redémarrage avec une clé d’audit stable |
| Limitation du parallélisme, des corps et des connexions | Active |
| CORS par liste d’origines exactes, en-têtes de sécurité | Actifs |
| HTTPS obligatoire et proxy de confiance | Imposés lorsque `NODE_ENV=production` ; proxy à installer |
| Chiffrement jardins/photos/contacts/plans/consignes | Disponible ; clé et migration explicites nécessaires |
| Sauvegarde, restauration et rotation de clé | Commandes disponibles ; exécution et planification à réaliser |
| Changement de mot de passe et déconnexion globale | API et interface Paramètres disponibles |
| Tests CI et mises à jour Dependabot | Fichiers fournis ; actifs après publication dans GitHub et activation des fonctionnalités |
| MFA/passkeys, vérification d’e-mail, récupération de compte | Non implémentés |
| Protection DDoS de l’hébergeur, supervision et alertes | À configurer sur l’infrastructure |

L’architecture cible est **une API Node sur une machine, derrière un seul proxy
HTTPS local**, avec une base SQLite sur disque local. Plusieurs réplicas derrière
un répartiteur, une base sur NFS et plusieurs chaînes de proxies ne sont pas
couverts par cette configuration.

## 2. Menaces prises en compte

- Vol d’un mot de passe ou d’un jeton pendant un transport non chiffré.
- Tentatives automatisées de connexion et création massive de comptes.
- Lecture ou modification du jardin d’un autre utilisateur.
- Réutilisation d’une invitation révoquée ou expirée.
- Consommation abusive des crédits plant.id et OpenAI.
- Saturation CPU/mémoire par hachage de mots de passe ou envoi de grosses photos.
- Vol d’un fichier SQLite ou d’une sauvegarde.
- Fuite de secrets, photos ou données de connexion dans les logs.
- Usurpation d’IP par les en-têtes `X-Forwarded-*`.

Une compromission complète du serveur donne potentiellement accès aux clés et
aux données déchiffrées en mémoire. Le chiffrement au repos ne protège pas contre
ce scénario. Un utilisateur connecté autorisé reçoit naturellement ses données
en clair via HTTPS ; il peut les copier.

## 3. Technologies et modifications

Aucune nouvelle bibliothèque de sécurité n’a été ajoutée à l’API. Elle utilise
`node:crypto`, `node:http`, `node:net`, `node:sqlite` et les primitives du système.
Les paramètres s’appuient sur les recommandations OWASP référencées en fin de
document ; leur adaptation à ce projet reste une décision d’implémentation.

| Fichier | Actions et responsabilité |
|---|---|
| `server/security.mjs` | Validation de configuration, origines CORS, identification du proxy, quotas, plafonds de concurrence, pseudonymisation et logs structurés |
| `server/errors.mjs` | Erreurs HTTP contrôlées et durée `Retry-After` |
| `server/encryption.mjs` | Chiffrement/déchiffrement AES-256-GCM avec contexte authentifié |
| `server/accounts.mjs` | Permissions SQLite, validation au démarrage, jardins chiffrés, plafond de sessions, révocation globale et changement de mot de passe |
| `server/delegations.mjs` | Consignes chiffrées ; accès aux jardins via le codec commun |
| `server/index.mjs` | Frontière HTTP commune : droits, HTTPS, quotas, JSON, limites, logs et arrêt propre |
| `src/services/apiBase.ts` | Refus d’une URL API HTTP lors d’un build en production |
| `src/features/accounts/accountApi.ts` | Appels aux routes de mot de passe et de révocation globale |
| `src/features/accounts/AccountSecurity.tsx` | Formulaire accessible avec confirmation du nouveau mot de passe ; déconnexion de tous les appareils |
| `src/features/settings/PreferencesScreen.tsx`, `src/app/App.tsx` | Intégration dans Paramètres et fermeture de la session locale après révocation |
| `scripts/security-migrate.mjs` | Migration explicite des données existantes puis compactage SQLite |
| `scripts/security-backup.mjs` | Instantané SQLite cohérent, sauvegarde chiffrée, restauration vérifiée sans écrasement |
| `scripts/security-rotate-key.mjs` | Rotation transactionnelle de la clé des jardins et des consignes |
| `scripts/check-api-runtime.mjs` | Vérification des imports API dans une copie temporaire sans l’arbre de dépendances Expo/React Native racine |
| `scripts/demo.mjs`, `scripts/demo-proxy.cjs` | Refus du mode production pour Expo ; compatibilité des requêtes web de même origine dans le tunnel de développement |
| `deploy/Caddyfile` | Exemple de terminaison HTTPS et remplacement des en-têtes transmis à Node |
| `deploy/folia.service` | Exemple systemd avec compte dédié, permissions minimales et limites de ressources |
| `.env.example`, `.gitignore` | Variables documentées ; sauvegardes et bases exclues de Git |
| `package.json`, `package-lock.json` | Commandes de sécurité et correctif verrouillé de `shell-quote` |
| `server/package.json`, `server/package-lock.json` | Arbre de production séparé, limité à `sharp` et ses dépendances ; Expo/Metro exclus de cette installation |
| `.github/workflows/security.yml`, `.github/dependabot.yml` | Tests et TypeScript sur push/PR ; propositions hebdomadaires de mises à jour |
| `tests/security*.test.mjs`, `tests/accounts-http.test.mjs` | Régressions sur les frontières de sécurité et adaptation au JSON strict |

Le fichier local `.env` avait les permissions `664` : elles ont été réduites à
`600`. Cette permission locale n’est pas un changement suivi par Git ; elle doit
être appliquée sur chaque machine qui héberge des secrets.

## 4. Comptes, mots de passe et sessions

### Mots de passe

- Longueur de 12 à 128 caractères ; validation côté serveur.
- `scrypt` : `N=32768`, `r=8`, `p=3`, sortie de 64 octets, `maxmem=64 Mio`.
- Sel cryptographiquement aléatoire de 16 octets pour chaque mot de passe.
- Comparaison via `timingSafeEqual`.
- Calcul scrypt également effectué pour une adresse inconnue lors de la connexion.
- Requêtes SQLite paramétrées pour les valeurs provenant des clients.
- Deux opérations de hachage concurrentes au maximum, partagées entre inscription,
  connexion et changement de mot de passe.

### Sessions

Jeton opaque de 32 octets aléatoires, transmis dans `Authorization: Bearer …`.
La base conserve uniquement son empreinte SHA-256 et sa date d’expiration. Une
session dure au maximum 24 h. Un compte possède au maximum cinq sessions ; une
sixième connexion invalide la plus ancienne.

Le client conserve sa session en mémoire React. Il n’enregistre ni le jeton ni
le mot de passe dans AsyncStorage. La fermeture réelle du processus ou le
rechargement web perd la session locale ; une mise en arrière-plan ne constitue
pas une fermeture ni une révocation du jeton sur le serveur.

| Route | Comportement |
|---|---|
| `POST /auth/logout` | Révoque la session courante |
| `POST /auth/logout-all` | Révoque toutes les sessions du compte |
| `POST /auth/password` | Vérifie `currentPassword`, applique `newPassword`, révoque toutes les sessions ; reconnexion nécessaire |

Le changement de mot de passe vérifie à nouveau la session après les calculs
asynchrones et conditionne l’écriture à l’ancien hash pour éviter une mise à
jour concurrente obsolète. La connexion vérifie également que le hash n’a pas
changé pendant le calcul.

En production, l’inscription est **fermée par défaut**. L’ouvrir exige
`FOLIA_ALLOW_REGISTRATION=true`. Cela ne vérifie pas la possession de l’adresse
mail. Une invitation exige à la fois le code secret et un compte portant
l’adresse prévue ; une adresse déclarée n’est pas une identité vérifiée.

## 5. Transport, proxy et CORS

En production, Node écoute uniquement `127.0.0.1` ou `::1`. Un accès sans HTTPS
est refusé. La terminaison TLS se fait dans Caddy ; le trafic Caddy → Node est
local à l’hôte. Ce dispositif n’est pas un chiffrement de ce dernier segment.

`FOLIA_TRUSTED_PROXIES` contient des **IP exactes**, sans joker ni plage CIDR.
Seule l’adresse réelle du socket peut autoriser l’utilisation des en-têtes
transmis. Depuis un proxy déclaré, l’API exige une seule IP valide dans
`X-Forwarded-For` et `X-Forwarded-Proto: https`. Les chaînes d’IP sont rejetées.
Les en-têtes provenant d’un client direct non déclaré ne donnent aucun droit.

Le proxy doit **remplacer** les en-têtes reçus du public. Le Caddyfile fourni
le fait. Tout processus local capable d’atteindre le socket représente une
frontière de confiance : le compte système de l’hôte doit être protégé.

`FOLIA_ALLOWED_ORIGINS` accepte des origines web exactes séparées par des virgules,
sans slash final : `https://app.example.com`. En production, HTTP est refusé dans
cette liste. Une origine non listée, y compris `null`, reçoit un refus. Une liste
vide autorise les clients natifs sans en-tête Origin, et aucun site web avec Origin.

CORS complète l’authentification ; il n’empêche pas un client natif ou un script
d’effectuer des requêtes sans Origin. Aucun cookie d’authentification n’est utilisé.
Les jetons ne doivent jamais figurer dans une URL.

Les réponses de l’API ajoutent `no-store`, `nosniff`, une CSP restrictive,
`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
une politique de permissions restrictive et `Vary: Origin`. HSTS est envoyé après
validation du transport HTTPS en production, sans préchargement de domaine.
Ces politiques concernent les réponses JSON de l’API ; les en-têtes du site web
Expo exporté doivent être configurés séparément par son hébergeur.

## 6. Quotas et résistance aux abus

Les compteurs sont dans `security_limits` et utilisent des clés HMAC-SHA-256.
Avec une `FOLIA_AUDIT_KEY` stable, ils survivent au redémarrage et ne sont pas
contournés en se reconnectant. Sans cette clé en développement, une clé aléatoire
par processus est utilisée ; les compteurs d’un ancien processus ne correspondent
plus aux nouvelles empreintes. Une clé stable est obligatoire en production.

| Périmètre | Limite |
|---|---|
| Toutes requêtes par IP, prévols compris | 120 / minute |
| Requêtes authentifiées par utilisateur | 120 / minute |
| Inscription + connexion par IP | 20 / 15 minutes |
| Inscription + connexion par adresse normalisée | 10 / 15 minutes |
| Changement de mot de passe par utilisateur | 5 / 15 minutes |
| Écritures de jardin par utilisateur | 30 / minute |
| Créations de délégation par utilisateur | 20 / 24 h |
| Acceptations d’invitation par utilisateur | 20 / 15 minutes |
| Identification, par IP et séparément mesure, par IP | 20 / 15 minutes |
| Chaque service payant par utilisateur | 10 / 15 minutes et 30 / 24 h |
| Identifications, tous utilisateurs | 200 / 24 h, configurable |
| Mesures IA, tous utilisateurs | 100 / 24 h, configurable |

Fenêtres fixes à partir de la première consommation, pas des jours calendaires.
Les tentatives échouées consomment aussi des quotas. Le plafond global fournisseur
est consommé après lecture du JSON et vérification de la présence de la clé,
avant validation métier et appel externe : c’est une borne de tentatives,
**pas une mesure de tokens, de facturation exacte ou de réponses réussies**.
Un quota atteint renvoie `429` et `Retry-After`. Certains plafonds de capacité
renvoient `503` avec un délai de réessai.

Les lignes expirées sont nettoyées au plus une fois par minute, lors d’une
requête qui consomme un quota. À 20 000 lignes, un nouveau compteur est refusé :
aucune éviction d’un compteur actif ne permet de contourner la limitation.
L’API gère ce stockage dans un processus unique ; le dimensionnement multi-instance
nécessiterait une stratégie de quotas et de concurrence partagée.

Autres bornes : 16 requêtes actives, deux téléversements de jardin, quatre
opérations fournisseur et une opération fournisseur par utilisateur simultanés.
Au niveau HTTP : 100 connexions, 100 requêtes par socket, en-têtes limités à
8 Kio, délai d’en-têtes de 10 s, délai de réception de 35 s et temporisation de
lecture du corps de 30 s. Les appels fournisseur disposent d’un timeout de 45 s.

Les corps doivent être des objets JSON, avec `Content-Type: application/json`
(éventuellement `charset=utf-8`). Les encodages compressés sont refusés. Les
limites sont vérifiées sur la longueur annoncée et les octets effectivement lus :
4 Kio pour les identifiants/mots de passe, 32 Kio pour créer une délégation,
25 Mio pour envoyer un jardin et 12 Mio pour une analyse photo. La collection
validée est limitée à 24 Mio et 200 plantes.

Les quotas applicatifs réduisent les abus, mais ne protègent pas une liaison
réseau saturée. Le filtrage réseau et la protection DDoS relèvent de l’hébergement.
Un attaquant peut aussi épuiser le quota global et provoquer une indisponibilité
fonctionnelle ; c’est le compromis retenu pour plafonner l’exposition financière.

## 7. Chiffrement et fichiers

### Données protégées

`FOLIA_DATA_KEY` est une clé AES de 256 bits, représentée par 64 caractères
hexadécimaux. Les écritures de jardins et de consignes sont chiffrées avec
AES-256-GCM, un nonce aléatoire de 12 octets et une étiquette de 16 octets.
L’enveloppe est versionnée `enc:v1:`. Le contexte authentifié lie chaque jardin
à `garden:<user_id>` et chaque consigne à `delegation:<id>`, empêchant leur
substitution entre lignes sans erreur d’authentification.

Le jardin contient notamment les photos, contacts et plans. Les e-mails des
comptes et invitations, dates, identifiants, droits et historiques d’actions des
gardiens restent dans des colonnes SQLite non chiffrées. Ce mécanisme n’est donc
**pas un chiffrement intégral de SQLite**. Une sauvegarde chiffrée protège en
revanche l’ensemble de l’instantané.

Les données chiffrées existantes sont vérifiées au démarrage. Une clé absente ou
incorrecte empêche l’ouverture. En production, les jardins ou consignes encore
en clair exigent la migration explicite avant démarrage.

Le fichier SQLite est créé avec des permissions `600`. Les nouveaux dossiers
sont créés en `700`, les symlinks du fichier principal sont refusés et le serveur
applique `umask 0077`. Les dossiers parents existants doivent également être
protégés par l’administrateur. `foreign_keys`, `secure_delete` et un délai de
verrouillage SQLite de 5 s sont activés.

`secure_delete` et `VACUUM` réduisent les traces dans le fichier courant. Ils
n’effacent pas les anciennes sauvegardes, snapshots, caches, journaux de stockage
ou blocs conservés par le SSD. Le chiffrement du volume reste nécessaire pour
compléter la protection de la machine.

### Trois secrets indépendants

- `FOLIA_DATA_KEY` : jardins et consignes.
- `FOLIA_AUDIT_KEY` : empreintes des quotas et pseudonymisation des IP.
- `FOLIA_BACKUP_KEY` : chiffrement intégral des instantanés de sauvegarde.

La production refuse une même clé pour données et audit. L’outil de sauvegarde
refuse une même clé pour sauvegarde et données. Maintenir les trois distinctes.
Ne jamais les préfixer par `EXPO_PUBLIC_`, les committer ou les passer comme
arguments de commande. Les injecter depuis un gestionnaire de secrets ou un
fichier d’environnement privé, hors du répertoire web. Leur perte peut rendre
les données ou sauvegardes irrécupérables.

Pour générer chaque valeur, exécuter séparément dans un terminal privé :

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex') + '\\n')"
```

Enregistrer le résultat directement dans le gestionnaire de secrets ; ne pas le
copier dans des tickets, une conversation, des logs CI ou une capture d’écran.

## 8. Sauvegarde, migration et rotation

Effectuer ces opérations avec une version maintenue de Node 22 au minimum,
depuis le dépôt et avec les variables secrètes chargées. Les commandes npm lisent
le `.env` local s’il existe ; des variables déjà présentes dans l’environnement
ont priorité. Vérifier `FOLIA_DB_PATH` avant toute opération.

### Première activation du chiffrement

1. Arrêter l’API. Préparer séparément les trois clés et conserver une copie
   de récupération dans un coffre accessible aux personnes autorisées.
2. Créer un dossier privé de sauvegarde : `mkdir -m 700 backups`.
3. Avec `FOLIA_BACKUP_KEY` et le chemin de la base configurés, créer une
   sauvegarde :

   ```bash
   npm run security:backup -- backups/avant-chiffrement.foliabak
   ```

4. Vérifier cette sauvegarde en la restaurant dans un fichier absent distinct :

   ```bash
   FOLIA_DB_PATH=data/restauration-test.sqlite npm run security:restore -- backups/avant-chiffrement.foliabak
   ```

   La restauration vérifie l’authenticité GCM puis `PRAGMA integrity_check`.
   Avant migration, cette copie peut contenir les jardins en clair : la protéger
   et la supprimer après vérification, selon la politique de conservation.
5. Configurer `FOLIA_DATA_KEY`, puis lancer :

   ```bash
   npm run security:migrate
   ```

6. Relancer l’API avec les mêmes clés. Contrôler la connexion, le jardin et
   les délégations. Conserver la sauvegarde chiffrée et sa clé séparément.

La migration chiffre les jardins dans une transaction puis les consignes dans
une autre. Elle est relançable après une interruption : une étape déjà chiffrée
est vérifiée et conservée. Un échec de la seconde étape peut laisser la première
terminée ; la production refuse de servir tant que toutes les données sensibles
ne sont pas correctement migrées. `VACUUM` compacte ensuite le fichier.

### Sauvegardes régulières et restauration

La commande `security:backup` utilise l’API de sauvegarde SQLite pour obtenir un
instantané cohérent. L’instantané temporaire est dans un dossier privé, chiffré
en flux avec AES-256-GCM, puis publié sans écraser un fichier existant. Le format
comprend une signature `FOLIABAK1`, le nonce, le contenu chiffré et l’étiquette.
Un nettoyage des fichiers temporaires est effectué même en cas d’échec géré.
Une interruption brutale peut laisser le dossier temporaire privé : prévoir un
nettoyage administratif des dossiers `.folia-backup-*` après contrôle.

Planifier une sauvegarde quotidienne, une copie chiffrée hors machine et un test
de restauration régulier. La planification et l’envoi hors machine ne sont pas
installés par ces changements. Définir explicitement la durée de conservation,
la capacité disque et les personnes ayant accès aux clés.

La restauration refuse de remplacer un fichier existant. Restaurer dans un
nouveau chemin, vérifier les données avec la clé de données correspondant à la
sauvegarde, puis basculer le service arrêté vers ce fichier. Révoquer les sessions
restaurées avant toute remise en ligne, car l’instantané peut contenir des
sessions et invitations qui ont été révoquées depuis sa création. Il faut aussi
revérifier ou révoquer les délégations restaurées.

### Rotation de clé de données

Arrêter l’API, sauvegarder et tester la restauration. Injecter l’ancienne clé
dans `FOLIA_DATA_KEY` et la nouvelle dans `FOLIA_NEW_DATA_KEY`, puis exécuter :

```bash
npm run security:rotate-key
```

Les jardins et les consignes sont rechiffrés ensemble dans une transaction.
Après succès, remplacer la valeur du secret `FOLIA_DATA_KEY` par la nouvelle clé,
retirer `FOLIA_NEW_DATA_KEY`, puis redémarrer et vérifier. Un échec après le COMMIT,
par exemple durant `VACUUM`, peut laisser la nouvelle clé déjà appliquée :
consulter l’erreur et vérifier hors ligne avant de relancer aveuglément.
Conserver les anciennes clés tant qu’une sauvegarde les nécessite.

Changer la clé d’audit change les empreintes : les anciens quotas ne correspondent
plus et les journaux ne sont plus corrélables avec cette clé. Planifier cette
rotation ; ne pas l’utiliser pour remettre arbitrairement les compteurs à zéro.
La rotation de la clé de sauvegarde s’applique aux nouvelles archives ; les
anciennes nécessitent toujours leur ancienne clé.

## 9. Déploiement de production

Exemple de variables serveur, à injecter hors du dépôt :

```dotenv
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=8787
FOLIA_DB_PATH=/var/lib/folia/folia.sqlite
FOLIA_TRUSTED_PROXIES=127.0.0.1,::1
FOLIA_ALLOWED_ORIGINS=https://app.example.com
FOLIA_ALLOW_REGISTRATION=false
FOLIA_IDENTIFY_DAILY_LIMIT=200
FOLIA_MEASURE_DAILY_LIMIT=100
# Injecter les clés réelles via le gestionnaire de secrets :
# FOLIA_DATA_KEY, FOLIA_AUDIT_KEY, FOLIA_BACKUP_KEY
# PLANT_ID_API_KEY et, si nécessaire, OPENAI_API_KEY
```

Les plafonds fournisseur sont des entiers entre 1 et 100 000 ; les valeurs
invalides provoquent un échec du démarrage. Une valeur élevée augmente le risque
financier. Configurer également les limites et alertes disponibles chez chaque
prestataire. L’absence d’une clé fournisseur désactive la fonction correspondante.

Pour le client de production : `EXPO_PUBLIC_API_URL=https://api.example.com`.
Ne pas utiliser le tunnel Expo comme hébergement de production.

Procédure d’infrastructure :

1. Préparer un compte système non privilégié `folia`, le code dans
   `/srv/phytolie`, les données dans `/var/lib/folia` et un environnement privé
   `/etc/folia/api.env`. Adapter les propriétaires et permissions.
2. Sur l’hôte API, installer uniquement les dépendances verrouillées du serveur
   avec `npm ci --prefix server --ignore-scripts --omit=dev --no-audit`. Ne pas
   installer les dépendances Expo racines sur cet hôte. Conserver les dossiers
   `src/` utilisés par les modèles partagés et `server/`, ainsi que les scripts
   de maintenance nécessaires ; le service démarre directement Node.
   Utiliser un Node maintenu ; le chemin `/usr/bin/node` du service est un exemple
   à adapter. Les versions installées via nvm dans un dossier personnel ne sont
   pas compatibles avec `ProtectHome=true` sans adaptation.
3. Adapter `deploy/folia.service`. Il restreint les écritures système au dossier
   de données, retire les capacités et applique des limites mémoire/processus.
   Ajuster ces limites avec des mesures de charge ; ce fichier n’a pas été
   installé sur la machine pendant ce travail.
4. Configurer le DNS et Caddy avec `deploy/Caddyfile`. Valider la configuration
   avec `caddy validate --config deploy/Caddyfile --adapter caddyfile`, puis
   installer/recharger le service selon les procédures de l’hôte. Les certificats
   automatiques nécessitent un domaine et une connectivité appropriés.
5. N’exposer publiquement que les ports du proxy nécessaires, généralement 80/443.
   Garder 8787 local. Restreindre également l’administration SSH à vos accès.
6. Tester depuis l’extérieur : TLS valide, accès aux jardins sans session refusé,
   origine web attendue autorisée, autre origine refusée, quotas actifs.
7. Configurer la rotation des journaux, les alertes 401/403/429/503, la saturation
   disque et l’échec des sauvegardes. Ne pas journaliser les corps ni
   `Authorization` dans le proxy ou les outils de supervision.

Caddy, systemd, le pare-feu et un vrai certificat TLS n’ont pas été installés ou
validés sur un hôte de production ici. Les tests HTTP simulent le proxy local ;
ils ne remplacent pas une recette du déploiement réel.

## 10. Journaux et gestion d’incident

Les journaux JSON de l’API contiennent un événement, une date, un identifiant de
requête, une route normalisée, la méthode, le statut et la durée. L’IP est
pseudonymisée via HMAC ; l’ID utilisateur peut être présent après authentification.
Ils ne contiennent ni mots de passe, jetons, codes d’invitation, clés, photos,
corps JSON, e-mails ni paramètres d’URL. Les erreurs internes retournent un
message générique et un identifiant de requête, sans stack trace côté client.

Les journaux restent des données sensibles et ne sont ni signés ni inviolables.
Les requêtes interrompues avant la fin de réponse peuvent ne pas produire
l’événement HTTP de fin. Compléter par des métriques et journaux de transport
sans données sensibles au niveau du proxy. Le code ne crée pas de système
d’alertes automatique ni de collecte distante.

En cas d’incident :

1. Fermer les inscriptions et suspendre l’accès public si nécessaire.
2. Préserver les éléments utiles sans diffuser de secrets ni photos.
3. Révoquer les sessions du compte concerné ; en cas de fuite globale, révoquer
   toutes les sessions et invitations via une intervention administrative hors
   ligne contrôlée. Aucune console publique d’administration n’est exposée.
4. Révoquer/remplacer les clés fournisseur compromises dans leur console.
5. Si une clé de données a fuité, corriger l’accès initial puis effectuer une
   rotation. Une rotation ne rend pas illisible une ancienne copie déjà volée
   avec sa clé.
6. Restaurer uniquement une sauvegarde vérifiée, contrôler sessions/délégations,
   puis vérifier les accès avant remise en ligne.

Pour signaler une faille, contacter le mainteneur du dépôt par un canal privé
convenu. Ne pas publier de secret, d’exploitation contre une instance active ou
de données personnelles dans une issue publique. Aucun canal de contact privé
dédié n’est configuré par ces changements.

## 11. Dépendances et automatisation

Un `npm audit --omit=dev` a été exécuté avec autorisation de transmettre les noms
et versions des dépendances au registre npm. L’audit initial signalait 16 paquets :
15 de sévérité haute et un critique. Les paquets parents apparaissent aussi dans
le bilan ; cela ne signifie pas 16 failles indépendantes.

`package.json` impose désormais `shell-quote@1.12.0` via `overrides` et le lockfile
est mis à jour. Cela corrige la plage affectée par
[GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).
Le nouvel audit racine relève **15 alertes hautes, zéro critique**.

Deux causes racines de sévérité haute restent sans version corrective publiée
au jour de la vérification :

- `braces@3.0.3`, déni de service par motifs profondément imbriqués :
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- `node-forge@1.4.0`, vérification de signatures RSA :
  [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

Ces bibliothèques viennent de l’outillage Expo/Metro et sont classées dans les
dépendances de production par l’arbre npm, même si le point d’entrée HTTP Folia
ne les importe pas. Cette analyse de chemin d’import n’est pas une preuve
universelle de non-exploitabilité : un serveur Metro public ou un processus de
signature peut avoir une autre surface. Ne pas publier Metro en production,
ne construire que du code de confiance et suivre les correctifs amont.

Le retour arrière automatique vers d’anciennes versions majeures d’Expo ou de
React Native proposé par `npm audit fix --force` n’a pas été appliqué : il casse
la compatibilité attendue et ne remplace pas une analyse. Aucune alerte n’est
masquée et aucun correctif artisanal de ces bibliothèques n’a été introduit.

Un manifeste et un verrou séparés dans `server/` permettent d’installer uniquement
`sharp` pour le runtime API. L’audit de cet arbre relève **zéro vulnérabilité connue**
au jour de l’exécution et est distinct de celui de l’outillage mobile. Cette séparation est effective en production si la
procédure d’installation ci-dessus est respectée ; installer également l’arbre
racine réintroduit les bibliothèques signalées sur le serveur.

La CI fournie exécute TypeScript, toute la suite de tests et l’audit des dépendances
isolées de l’API, avec échec à partir de la sévérité haute. Ses actions sont
référencées par SHA, son jeton a seulement `contents: read` et les identifiants
Git ne sont pas conservés au checkout. Le fichier Dependabot propose les mises
à jour npm et GitHub Actions chaque semaine. Il faut publier ces fichiers et
activer les règles/alertes voulues dans GitHub ; aucune protection de branche
ou option GitHub n’a été modifiée à distance.

## 12. Vérifications et limites restantes

Commandes de contrôle :

```bash
npm run typecheck
npm run test:security
npm test
npm run test:api-runtime # après npm ci --prefix server --ignore-scripts --no-audit
npm audit --omit=dev
npm audit --prefix server --omit=dev
```

Les tests ajoutés couvrent notamment les configurations dangereuses, les faux
proxies, le transport imposé, les origines, les méthodes, le JSON et les limites
de corps, la persistance des quotas malgré un changement d’IP et un redémarrage,
la saturation des compteurs, la concurrence, la révocation des sessions, le
changement de mot de passe, le chiffrement et les contextes échangés, les clés
incorrectes, la migration de données existantes, les actions des gardiens sur
données chiffrées, la restauration et les sauvegardes altérées, ainsi que
l’absence de secrets testés dans les journaux HTTP.

Dernière validation locale : **122 tests réussis, zéro échec**, vérification
TypeScript réussie et imports de l’API vérifiés sans les dépendances mobiles
racines. La rotation de clé est incluse dans le scénario des jardins chiffrés.
Les tests utilisent des données et bases temporaires ; ils n’ont pas migré ni
réécrit la base utilisateur existante.

Travaux restant à dimensionner avant ouverture à une large audience :

- Vérification des e-mails, récupération de compte et MFA/passkeys.
- Limitation de la création automatisée de comptes au-delà des plafonds IP.
- Suppression de compte, durées de rétention et purge des anciennes délégations,
  actions et photos ; les limites de taille par jardin ne plafonnent pas le
  nombre total d’utilisateurs ni l’occupation disque globale.
- Suivi précis des tokens, dépenses réelles et alertes fournisseur.
- Chiffrement de volume et protection du matériel, des clés et de la mémoire.
- Isolation d’un environnement de production distinct de l’outillage mobile.
- Validation des métadonnées des photos envoyées au service de mesure : la route
  d’identification normalise et retire les métadonnées, tandis que la mesure
  transmet actuellement l’image fournie après validation de son enveloppe.
- Recette sur téléphone des nouveaux contrôles de compte ; la compilation
  TypeScript et les tests d’API ne constituent pas un test visuel natif.
- Audit indépendant, tests de charge, protection DDoS et supervision effective.

## 13. Références techniques

- [OWASP — sécurité REST](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP — stockage des mots de passe](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP — stockage chiffré](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node — SQLite](https://nodejs.org/docs/latest-v22.x/api/sqlite.html)
- [Node — cryptographie](https://nodejs.org/docs/latest-v22.x/api/crypto.html)
- [Caddy — proxy inverse et en-têtes](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [GitHub — action checkout retenue](https://github.com/actions/checkout/tree/11bd71901bbe5b1630ceea73d27597364c9af683)
- [GitHub — action setup-node retenue](https://github.com/actions/setup-node/tree/49933ea5288caeca8642d1e84afbd3f7d6820020)

## Liens de personne de confiance

Les routes `/guest/garden` (GET) et `/guest/water` (POST) utilisent un secret de 32 octets aléatoires encodé en base64url, transmis dans `Authorization: Bearer …`. Il est différent d’une session de compte et stocké sous forme SHA-256 uniquement. Le lien Web place le secret dans son fragment ; le code ne figure ni dans l’URL de l’API ni dans les journaux applicatifs.

La possession du lien autorise la consultation des champs d’entretien des seules plantes sélectionnées et la confirmation d’arrosage pendant la période choisie (90 jours maximum). Elle ne permet aucune gestion de compte, de fiche ou d’invitation. Les dates et la révocation sont contrôlées à chaque lecture et écriture côté serveur ; les plantes archivées sont exclues. Les quotas, CORS, exigences TLS de production, en-têtes sans cache et écritures transactionnelles restent appliqués. L’activité identifie un accès par lien, sans prétendre authentifier la personne qui le possède.

Au démarrage, le schéma est migré dans une transaction : les anciens liens non consommés deviennent directs avec leur expiration initiale ; les accès déjà acceptés par compte sont conservés. `caretaker_actions.guest_id` devient nullable pour les arrosages par lien, en préservant les lignes précédentes et leurs clés étrangères.
