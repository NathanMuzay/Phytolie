# Livraison : 4 issues majeures et 8 mineures

Lot préparé le 5 novembre 2026, à partir des issues ouvertes de NathanMuzay/Phytolie et de leurs étiquettes `majeure` / `mineure`. Les numéros ci-dessous sont les **numéros GitHub** : certains titres PHY ont une numérotation différente.

## Issues majeures

| Issue | Critère réalisé | Implémentation et preuve |
| --- | --- | --- |
| [#65 — Recherche, modification et archivage](https://github.com/NathanMuzay/Phytolie/issues/65) | Collection gérable, archives distinctes de la suppression | Recherche combinée, édition conservant le journal, vues Actives/Archivées, archivage et restauration. Suspension des tâches, rappels et accès des invités ; conservation des données et photos. `CollectionScreen.tsx`, `PlantDetailScreen.tsx`, `App.tsx`, `homeGarden.ts`, `server/delegations.mjs`. Tests `collection`, `careRecords`, `delegations`. |
| [#89 — Arrosage avec date et quantité](https://github.com/NathanMuzay/Phytolie/issues/89) | Historique et échéance actualisés | Date et heure locale, quantité réellement versée facultative et note. Historique trié par date effective, quantité indépendante de la dose estimée. `CareJournal.tsx`, `careRecords.ts`, `model.ts`. Tests `careRecords`, `irrigation`, `reminders`. |
| [#91 — Correction, annulation et rétroactivité](https://github.com/NathanMuzay/Phytolie/issues/91) | Historique et calendrier cohérents | Correction des arrosages, annulation confirmée conservant une trace, saisie rétroactive et recalcul depuis le dernier soin actif. Dates impossibles/futures et doublons du jour refusés. Conservation des anciennes dates et observations plus récentes. Tests `careRecords` et parcours navigateur. Périmètre de cette issue du domaine Arrosage : les confirmations d’arrosage. |
| [#99 — Confirmation du rempotage](https://github.com/NathanMuzay/Phytolie/issues/99) | Nouveau pot, substrat et date enregistrés | Rempotage daté, diamètre et profondeur, mélange réel et prochain contrôle. Journal avant/après, recalcul automatique depuis les nouveaux paramètres, retrait de l’ancienne mesure sur photo, aucun faux arrosage. `CareJournal.tsx`, `careRecords.ts`. Tests `careRecords` et parcours navigateur. |

## Issues mineures

| Issue | Critère réalisé | Implémentation et preuve |
| --- | --- | --- |
| [#11 — Règles de contribution](https://github.com/NathanMuzay/Phytolie/issues/11) | README, branches, conventions et revue | `CONTRIBUTING.md` définit branches, commits, validation et revue ; lien dans le README. Relecture des chemins et commandes. La protection distante de branche n’est pas une modification annoncée. |
| [#13 — Modèles d’issues et de PR](https://github.com/NathanMuzay/Phytolie/issues/13) | Description et validation demandées | Formulaires `.github/ISSUE_TEMPLATE/bug.yml` et `feature.yml`, champs requis description/reproduction ou périmètre, validation ; modèle `.github/pull_request_template.md`. |
| [#49 — GitHub Actions](https://github.com/NathanMuzay/Phytolie/issues/49) | Contrôles et builds déclenchés sur PR | Workflow `security.yml` existant complété par un job `export` lançant `expo export --platform web --platform android`, sans secret, en plus des contrôles. Export équivalent exécuté localement. L’exécution distante du nouveau job attend la publication d’une PR. Il s’agit d’un export de bundles, pas d’un APK signé. |
| [#64 — Synonymes et recherche botanique](https://github.com/NathanMuzay/Phytolie/issues/64) | Recherche par noms communs et scientifiques | Index sourcé dans `botanicalNames.ts`, recherche sans accents ni casse et correspondances dans les deux sens. Groupes Nephrolepis/Boston fern, Dracaena/Sansevieria, Monstera. Même profil d’entretien pour les noms équivalents. Tests `careRecords` et navigateur. Catalogue volontairement limité à ces groupes. |
| [#93 — Catalogue des substrats](https://github.com/NathanMuzay/Phytolie/issues/93) | Composition, propriétés et provenance structurées | Quatre profils dans `substrates.ts`, sélecteur avec composition, propriétés et source consultable. Validation des descriptions persistées. Tests `careRecords` et documentation `REPOTTING.md`. |
| [#96 — Historique des substrats](https://github.com/NathanMuzay/Phytolie/issues/96) | Moteur utilisant le substrat actuel | Instantanés ancien/nouveau à l’édition ou au rempotage, date et provenance dans le journal. Synchronisation du type réel avec `irrigation.substrate`, conservation des arrosages. Tests comparant intervalle et dose avant/après. |
| [#97 — Code inconnu et mélange maison](https://github.com/NathanMuzay/Phytolie/issues/97) | Description manuelle possible | Modes Mélange maison et Produit/code inconnu ; nom, composition, rétention et référence produit facultative. Provenance utilisateur explicite. Saisie et relecture persistée vérifiées. La lecture par caméra d’un code-barres appartient à une autre issue. |
| [#98 — Règles de rempotage](https://github.com/NathanMuzay/Phytolie/issues/98) | Espèce, racines, pot, substrat et observations considérés | Règles documentées dans `REPOTTING.md`, aide qualitative dans `repotting.ts` et observations dans le formulaire. Informations manquantes signalées ; contrôle de la motte distinct d’une obligation de rempoter. Tests `careRecords`. |

## Validation et portée

- `npm run typecheck` : réussi.
- `npm test` : 145 tests réussis lors de la vérification du lot, dont les cas ajoutés de conservation des données, corrections et accès des invités.
- `npm run test:api-runtime` : réussi sans dépendances Expo/React Native racines.
- Export Expo Web et Android : réussi. Les dépendances restent verrouillées ; aucun service IA ni donnée réelle n’est nécessaire pour ces vérifications.
- Parcours Web avec API réelle et base fictive : recherche par synonymes, saisie datée avec quantité, correction, annulation, rétroactivité, rempotage, mélange/code manuel, changement de substrat, archivage et restauration ; relecture après reconnexion. Affichage contrôlé à 1 440, 390 et 320 px, ainsi qu’à 320 px avec texte à 200 % et contraste renforcé, sans débordement horizontal.
- Guide `USAGE.md`, règles `REPOTTING.md` et notice de confidentialité intégrée actualisés.

Les modifications sont présentes **localement**. Ce document ne signifie pas que les commits sont publiés, déployés ou que les issues ont été clôturées sur GitHub. Aucun essai sur téléphone physique ni build natif signé n’est revendiqué. Les calculs restent des estimations guidant l’observation du terreau.
