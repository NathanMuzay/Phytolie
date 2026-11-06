# Notice de confidentialité Phytolie

La notice est intégrée dans l’application : **Mon espace → Confidentialité et données personnelles (RGPD)**. Elle est aussi accessible depuis **Plus → Confidentialité**, avant la connexion et directement à l’adresse `#/confidentialite` sur le web.

Le responsable renseigné est **Nathan MUZAY**, contact **nathan.muzay@epitech.eu**. Ces informations ont été fournies par le responsable du projet. La notice est datée du 5 novembre 2026.

## Informations et sources

Les catégories, finalités, destinataires et conservations décrits correspondent au code actuel :

| Traitement | Sources vérifiées |
| --- | --- |
| Compte, mot de passe, sessions et version de collection | `server/accounts.mjs`, `src/features/accounts/accountApi.ts` |
| Plantes, entretien, mesures et relevés | `src/shared/model.ts`, `src/features/plants/irrigation.ts`, `src/features/light`, `src/features/measurement` |
| Photos envoyées aux prestataires | `server/identification.mjs`, `server/measurement.mjs`, `src/app/App.tsx` |
| Maison et emplacement | `src/features/home/home.ts`, `src/features/home/HomeScreen.tsx` |
| Ville et météo envoyées directement à Open-Meteo | `src/services/weather.ts` |
| Coordonnées du contact, invitations et actions | `server/delegations.mjs`, `src/features/caretakers` |
| Notifications locales | `src/services/notifications.ts`, `src/services/reminders.ts` |
| Préférences et ancien carnet local | `src/shared/accessibility/AccessibilityProvider.tsx`, import dans `src/app/App.tsx` |
| Quotas et journaux | `server/security.mjs`, `server/index.mjs` |
| Sauvegardes et chiffrement | `server/encryption.mjs`, `scripts/security-backup.mjs`, `SECURITY.md` |

Le contenu se trouve dans `src/features/privacy/privacy.ts` et sa présentation dans `PrivacyScreen.tsx`. Une recherche permet de retrouver une catégorie, dont les champs, le caractère facultatif ou nécessaire, les destinataires, la conservation et la base légale sont dépliables.

Le cadre d’information reprend les points des [recommandations CNIL sur la transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) et des [droits des personnes](https://www.cnil.fr/fr/passer-laction/les-droits-des-personnes-sur-leurs-donnees). La notice renvoie également aux informations API [Kindwise](https://www.kindwise.com/faq), aux conditions et informations de confidentialité [Open-Meteo](https://open-meteo.com/en/terms) et à la [réclamation CNIL](https://www.cnil.fr/fr/plaintes).

## Points encore à définir par le responsable

La page expose ces limites sans annoncer de garantie absente du produit :

- Hébergeur et pays d’un déploiement de production. Le fonctionnement local documenté utilise l’ordinateur qui lance l’API.
- Durée d’inactivité avant effacement des comptes ; purge des invitations expirées et des actions déléguées ; durée des journaux techniques et des sauvegardes, puis mécanismes de purge correspondants.
- Entités contractantes, accords de sous-traitance, conservation et éventuelles réutilisations des photos chez les prestataires, lieux de traitement et garanties des transferts hors EEE.
- Validation des bases légales et de la mise en balance des intérêts légitimes pour le contexte réel d’exploitation.
- Organisation du traitement manuel des demandes reçues par e-mail. La notice ne crée pas un système automatique d’effacement ou d’export complet ; elle n’annonce pas ces fonctions comme disponibles.

L’expiration de 24 h d’une session ou de la période choisie pour un lien invité est une durée de validité, distincte de l’effacement matériel de toutes les données. Le paramètre OpenAI `store: false` n’est pas présenté comme une garantie de rétention nulle. La suppression d’une fiche n’est pas présentée comme effaçant automatiquement les copies des prestataires, les journaux ou les sauvegardes.

La notice doit être actualisée si le déploiement, les destinataires, les finalités ou les conservations changent. Elle ne constitue pas à elle seule une vérification complète de conformité de l’exploitation.

## Extension du journal des soins et archivage

La catégorie « Arrosages et historique » couvre désormais la quantité réellement versée facultative, les notes, les dates de correction et d’annulation, les dimensions avant/après rempotage, les instantanés de substrat et leur référence produit facultative, ainsi que la date d’archivage. Les données sont sauvegardées avec le jardin. L’espace invité reçoit les données d’entretien nécessaires et le dernier arrosage, sans les notes et le journal privés. L’archivage suspend l’accès des invités et les rappels, tout en conservant les données ; une invitation encore valide retrouve son accès après restauration. Les observations de racines et de croissance du formulaire sont temporaires sauf si l’utilisateur les décrit dans la note enregistrée.

Le journal conserve au plus 500 événements par plante ; un nouvel ajout au-delà est refusé. Les annulations restent visibles ; seules les dates actives alimentent les échéances et les 100 dates de compatibilité. La suppression de la fiche retire son journal de la collection active, sans modifier les limites distinctes de conservation des journaux serveur et des sauvegardes décrites ci-dessus.

## Accès invité par lien sans compte

Le lien secret est un accès réutilisable jusqu’à la fin de la période choisie (90 jours maximum), révocable par le propriétaire. Le destinataire n’a pas besoin de compte. Son e-mail, saisi par le propriétaire, sert de repère de suivi : la personne qui confirme un arrosage par lien n’est pas authentifiée nominativement. Le journal indique une action de l’accès partagé, avec `guest_id` nul ; les anciens accès par compte conservent leur attribution.

L’espace affiche l’e-mail du propriétaire pour identifier le jardin, les consignes, les photos et les données d’entretien des seules plantes sélectionnées. Une liste de champs autorisés exclut les notes privées, journaux détaillés, mesures et positions du plan. Le code reste dans le lien fourni et en mémoire dans l’application, sans stockage persistant ajouté par Phytolie ; le navigateur peut conserver le lien dans son historique. L’API n’en conserve que l’empreinte et reçoit le code en en-tête d’autorisation. Les requêtes invitées restent soumises aux règles HTTPS/CORS et aux limites de requêtes existantes.
