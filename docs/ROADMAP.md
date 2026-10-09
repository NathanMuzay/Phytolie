# Roadmap Phytolie — tâches restantes

> Plan établi le 9 octobre 2026 à partir des issues ouvertes de NathanMuzay/Phytolie. Les 64 issues déjà clôturées ne sont pas planifiées.

## Cadence et calendrier

- Début proposé : **lundi 12 octobre 2026**.
- **10 sprints de 14 jours**, avec **4 majeures + 8 mineures par sprint**.
- Backlog existant : **40 majeures et 71 mineures ouvertes**.
- Compléments : **9 nouvelles mineures**, PHY-176 à PHY-184, pour valider/documenter les nouveaux parcours.
- Total planifié : **120 tâches = 40 majeures + 80 mineures**.
- Fin complète : **dimanche 28 février 2027**.

### Écart avec l'objectif initial de janvier

À 4 majeures par sprint, les 40 majeures nécessitent 10 sprints. Au 31 janvier, 8 sprints permettent d'en finir 32 : les sprints 9 et 10 restent en février. Pour conserver tout le périmètre et terminer en janvier, il faudrait une cadence moyenne de **5 majeures par sprint**, et davantage de mineures par sprint. Ce document suit la cadence demandée de 4/8.

Les anciennes dates proposées dans les descriptions des issues doivent être réconciliées avec ce nouveau calendrier. Les dates de fin de sprint ci-dessous constituent la référence de cette roadmap.

## Comment utiliser ce plan

1. Les listes ne contiennent que des issues ouvertes lors de la préparation ; pour une issue partielle, réaliser seulement les éléments manquants.
2. Au début du sprint, traiter les décisions, maquettes, règles et données nécessaires aux majeures. Suivre l'ordre précisé dans chaque sprint.
3. Les chaînes indépendantes peuvent avancer en parallèle ; ne pas commencer une intégration tant que son entrée ou contrat nécessaire n'est pas défini.
4. Clôturer une tâche après contrôle de son critère, ajouter une preuve et effectuer une démonstration de fin de sprint.
5. Les nombres d'issues ne sont pas une estimation de charge. Dimensionner l'équipe et réduire/découper une tâche trop grande avant le démarrage ; aucun délai de prestataire ni validation de store n'est garanti.
6. Le sprint 6 couvre les fêtes de fin d'année : vérifier la disponibilité réelle de l'équipe.

## Vue d'ensemble

| Sprint | Dates | Objectif | Majeures | Mineures |
|---|---|---|---:|---:|
| 1 | 12/10/2026 → 25/10/2026 | Cadrage, modèle de données et comptes | 4 | 8 |
| 2 | 26/10/2026 → 08/11/2026 | Validation produit, catalogue et collection | 4 | 8 |
| 3 | 09/11/2026 → 22/11/2026 | Arrosage fiable et journal des soins | 4 | 8 |
| 4 | 23/11/2026 → 06/12/2026 | Terreau, codes-barres et rempotage | 4 | 8 |
| 5 | 07/12/2026 → 20/12/2026 | Scan d'habitat, avant-achat et diagnostic initial | 4 | 8 |
| 6 | 21/12/2026 → 03/01/2027 | Suivi de santé et calendrier unifié | 4 | 8 |
| 7 | 04/01/2027 → 17/01/2027 | Mode vacances et délégation complète | 4 | 8 |
| 8 | 18/01/2027 → 31/01/2027 | Hors connexion, historique complet et sauvegardes | 4 | 8 |
| 9 | 01/02/2027 → 14/02/2027 | Production sécurisée et bêta | 4 | 8 |
| 10 | 15/02/2027 → 28/02/2027 | Stabilisation, recette et livraison | 4 | 8 |

## Sprint 1 — Cadrage, modèle de données et comptes

**Dates : 12/10/2026 au 25/10/2026. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un périmètre validé, des comptes récupérables et un modèle de données extensible ; cycle de vie des photos défini et implémenté.

**Ordre de travail :** Commencer par PHY-002/003/010/140 et cadrer PHY-001. Mettre en place contribution, CI et organisation. Étendre PHY-051 avant les parcours PHY-053/056.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-001 · #1](https://github.com/NathanMuzay/Phytolie/issues/1) | Définir le périmètre de livraison |
| [PHY-051 · #51](https://github.com/NathanMuzay/Phytolie/issues/51) | Étendre le modèle aux nouveaux soins/scans et versionner les migrations |
| [PHY-053 · #53](https://github.com/NathanMuzay/Phytolie/issues/53) | Ajouter récupération du compte et renouvellement de session |
| [PHY-056 · #56](https://github.com/NathanMuzay/Phytolie/issues/56) | Finaliser suppression et nettoyage des photos stockées |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-002 · #2](https://github.com/NathanMuzay/Phytolie/issues/2) | Choisir les plateformes cibles |
| [PHY-003 · #3](https://github.com/NathanMuzay/Phytolie/issues/3) | Répartir les rôles et disponibilités |
| [PHY-010 · #10](https://github.com/NathanMuzay/Phytolie/issues/10) | Estimer la charge et ajuster le planning |
| [PHY-011 · #11](https://github.com/NathanMuzay/Phytolie/issues/11) | Finaliser conventions, règles de revue et contribution du dépôt existant |
| [PHY-012 · #12](https://github.com/NathanMuzay/Phytolie/issues/12) | Configurer le GitHub Project et saisir le backlog |
| [PHY-014 · #14](https://github.com/NathanMuzay/Phytolie/issues/14) | Planifier les revues hebdomadaires et démonstrations |
| [PHY-140 · #139](https://github.com/NathanMuzay/Phytolie/issues/139) | Définir conservation, suppression et partage |
| [PHY-049 · #49](https://github.com/NathanMuzay/Phytolie/issues/49) | Configurer GitHub Actions |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **25/10/2026**.

## Sprint 2 — Validation produit, catalogue et collection

**Dates : 26/10/2026 au 08/11/2026. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un catalogue sourcé, une collection recherchable/archivable et des droits d'export/suppression ; budget et proposition de valeur validés.

**Ordre de travail :** Mener les études et vérifier les licences d'abord. Fixer seuils et parcours. Constituer PHY-062 avant recherche/archivage ; finaliser budget PHY-020 après les études. Export/suppression s'appuient sur le modèle du sprint 1.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-020 · #20](https://github.com/NathanMuzay/Phytolie/issues/20) | Définir le modèle économique et le budget |
| [PHY-062 · #60](https://github.com/NathanMuzay/Phytolie/issues/60) | Constituer le catalogue végétal sourcé |
| [PHY-065 · #65](https://github.com/NathanMuzay/Phytolie/issues/65) | Ajouter recherche et archivage de la collection existante |
| [PHY-143 · #142](https://github.com/NathanMuzay/Phytolie/issues/142) | Exporter les données et supprimer un compte |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-005 · #5](https://github.com/NathanMuzay/Phytolie/issues/5) | Définir les parcours utilisateur |
| [PHY-007 · #7](https://github.com/NathanMuzay/Phytolie/issues/7) | Définir les seuils de qualité IA et mesures |
| [PHY-013 · #13](https://github.com/NathanMuzay/Phytolie/issues/13) | Créer les modèles d'issues et de PR |
| [PHY-015 · #15](https://github.com/NathanMuzay/Phytolie/issues/15) | Interroger les utilisateurs du persona Camille |
| [PHY-016 · #16](https://github.com/NathanMuzay/Phytolie/issues/16) | Comparer les applications concurrentes |
| [PHY-019 · #19](https://github.com/NathanMuzay/Phytolie/issues/19) | Définir la proposition de valeur et les promesses |
| [PHY-021 · #21](https://github.com/NathanMuzay/Phytolie/issues/21) | Définir les indicateurs de réussite |
| [PHY-141 · #141](https://github.com/NathanMuzay/Phytolie/issues/141) | Vérifier licences des données et dépendances |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **08/11/2026**.

## Sprint 3 — Arrosage fiable et journal des soins

**Dates : 09/11/2026 au 22/11/2026. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Des règles relues, une marge de retard étayée et un journal de soins corrigeable, avec date et quantité réellement renseignées.

**Ordre de travail :** Formaliser PHY-079 avant la relecture PHY-080 ; les critères PHY-007 et le protocole d'évaluation précèdent PHY-078. Valider ensuite PHY-087. Définir l'événement de soin dans PHY-089 avant correction/rétroactivité PHY-090.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-080 · #80](https://github.com/NathanMuzay/Phytolie/issues/80) | Faire relire et valider les règles par un expert botanique |
| [PHY-087 · #87](https://github.com/NathanMuzay/Phytolie/issues/87) | Étayer et finaliser le calcul de tolérance au retard |
| [PHY-089 · #89](https://github.com/NathanMuzay/Phytolie/issues/89) | Ajouter date choisie et quantité réellement versée à la confirmation d'un soin |
| [PHY-090 · #91](https://github.com/NathanMuzay/Phytolie/issues/91) | Ajouter correction, annulation et saisie rétroactive des soins |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-008 · #8](https://github.com/NathanMuzay/Phytolie/issues/8) | Définir les règles métier des soins et rappels |
| [PHY-028 · #28](https://github.com/NathanMuzay/Phytolie/issues/28) | Maquetter les soins, l'historique et le calendrier |
| [PHY-036 · #36](https://github.com/NathanMuzay/Phytolie/issues/36) | Comparer les solutions d'identification végétale |
| [PHY-037 · #37](https://github.com/NathanMuzay/Phytolie/issues/37) | Prototyper et mesurer l'identification |
| [PHY-078 · #79](https://github.com/NathanMuzay/Phytolie/issues/79) | Évaluer la précision sur un jeu indépendant selon les seuils définis |
| [PHY-079 · #78](https://github.com/NathanMuzay/Phytolie/issues/78) | Formaliser les règles d'arrosage sourcées |
| [PHY-081 · #81](https://github.com/NathanMuzay/Phytolie/issues/81) | Saisir température et humidité intérieures |
| [PHY-063 · #64](https://github.com/NathanMuzay/Phytolie/issues/64) | Gérer synonymes et recherche botanique |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **22/11/2026**.

## Sprint 4 — Terreau, codes-barres et rempotage

**Dates : 23/11/2026 au 06/12/2026. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un substrat identifié par code-barres et un parcours complet de rempotage, avec recommandations, confirmation et rappels.

**Ordre de travail :** Vérifier la couverture des produits PHY-042, structurer PHY-093 et définir PHY-098 avant les recommandations. Implémenter lecture PHY-094 puis résolution PHY-095 ; gérer inconnu et mélanges ; confirmer rempotage puis intégrer les rappels.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-094 · #94](https://github.com/NathanMuzay/Phytolie/issues/94) | Implémenter le lecteur de code-barres |
| [PHY-095 · #95](https://github.com/NathanMuzay/Phytolie/issues/95) | Identifier et confirmer le produit scanné |
| [PHY-099 · #100](https://github.com/NathanMuzay/Phytolie/issues/100) | Ajouter recommandations et notifications dédiées de rempotage |
| [PHY-100 · #99](https://github.com/NathanMuzay/Phytolie/issues/99) | Ajouter confirmation de rempotage, historique et recalcul |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-029 · #29](https://github.com/NathanMuzay/Phytolie/issues/29) | Maquetter le scan terreau et le rempotage |
| [PHY-042 · #42](https://github.com/NathanMuzay/Phytolie/issues/42) | Vérifier les sources terreau par code-barres |
| [PHY-093 · #93](https://github.com/NathanMuzay/Phytolie/issues/93) | Définir le catalogue des substrats |
| [PHY-096 · #97](https://github.com/NathanMuzay/Phytolie/issues/97) | Gérer code inconnu et mélange maison |
| [PHY-097 · #96](https://github.com/NathanMuzay/Phytolie/issues/96) | Historiser les changements de substrat |
| [PHY-098 · #98](https://github.com/NathanMuzay/Phytolie/issues/98) | Définir les règles de rempotage |
| [PHY-041 · #41](https://github.com/NathanMuzay/Phytolie/issues/41) | Comparer les solutions de diagnostic végétal |
| [PHY-111 · #111](https://github.com/NathanMuzay/Phytolie/issues/111) | Définir la couverture maladies et parasites |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **06/12/2026**.

## Sprint 5 — Scan d'habitat, avant-achat et diagnostic initial

**Dates : 07/12/2026 au 20/12/2026. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un scan de pièce exploitable, une évaluation avant achat sans ajout à la collection et un premier diagnostic explicite sur ses limites.

**Ordre de travail :** Prototyper PHY-039 et maquetter PHY-030/031 avant capture/extraction. PHY-103 précède PHY-104 puis PHY-107. Pour la santé, préparer PHY-112/113 avant PHY-114, puis afficher confiance et conseils. Les deux chaînes peuvent avancer en parallèle.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-103 · #103](https://github.com/NathanMuzay/Phytolie/issues/103) | Implémenter le scan guidé de pièce |
| [PHY-104 · #104](https://github.com/NathanMuzay/Phytolie/issues/104) | Extraire les caractéristiques du scan et permettre leur confirmation |
| [PHY-107 · #107](https://github.com/NathanMuzay/Phytolie/issues/107) | Évaluer une plante avant achat |
| [PHY-114 · #114](https://github.com/NathanMuzay/Phytolie/issues/114) | Intégrer le moteur de diagnostic |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-030 · #30](https://github.com/NathanMuzay/Phytolie/issues/30) | Maquetter le scan de pièce et l'avant-achat |
| [PHY-031 · #31](https://github.com/NathanMuzay/Phytolie/issues/31) | Maquetter le diagnostic et le suivi santé |
| [PHY-039 · #39](https://github.com/NathanMuzay/Phytolie/issues/39) | Prototyper le scan de pièce |
| [PHY-108 · #109](https://github.com/NathanMuzay/Phytolie/issues/109) | Ajouter les verdicts compatible / à adapter / déconseillé / indéterminé |
| [PHY-112 · #112](https://github.com/NathanMuzay/Phytolie/issues/112) | Constituer le jeu d'évaluation santé |
| [PHY-113 · #113](https://github.com/NathanMuzay/Phytolie/issues/113) | Guider les photos de diagnostic |
| [PHY-115 · #115](https://github.com/NathanMuzay/Phytolie/issues/115) | Afficher confiance et limites du diagnostic |
| [PHY-116 · #116](https://github.com/NathanMuzay/Phytolie/issues/116) | Ajouter des conseils de soin sourcés |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **20/12/2026**.

## Sprint 6 — Suivi de santé et calendrier unifié

**Dates : 21/12/2026 au 03/01/2027. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un suivi longitudinal de santé, des scans programmés et un calendrier commun aux différents soins.

**Ordre de travail :** Mettre en place PHY-117 avant le suivi PHY-119. Définir événements et fréquence avant PHY-118 ; intégrer ensuite tous les soins dans PHY-121. Évaluer les erreurs, tester les notifications et les parcours utilisateurs.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-117 · #117](https://github.com/NathanMuzay/Phytolie/issues/117) | Comparer les scans santé dans le temps |
| [PHY-118 · #119](https://github.com/NathanMuzay/Phytolie/issues/119) | Programmer scans réguliers et rappels |
| [PHY-119 · #118](https://github.com/NathanMuzay/Phytolie/issues/118) | Suivre l'évolution après détection |
| [PHY-121 · #120](https://github.com/NathanMuzay/Phytolie/issues/120) | Compléter le calendrier avec rempotage et scans santé |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-018 · #18](https://github.com/NathanMuzay/Phytolie/issues/18) | Confirmer le nom et vérifier sa disponibilité |
| [PHY-022 · #22](https://github.com/NathanMuzay/Phytolie/issues/22) | Créer l'identité visuelle |
| [PHY-034 · #34](https://github.com/NathanMuzay/Phytolie/issues/34) | Tester le prototype avec des utilisateurs |
| [PHY-046 · #46](https://github.com/NathanMuzay/Phytolie/issues/46) | Valider les replis des fonctionnalités expérimentales |
| [PHY-109 · #108](https://github.com/NathanMuzay/Phytolie/issues/108) | Proposer emplacements ou adaptations |
| [PHY-120 · #122](https://github.com/NathanMuzay/Phytolie/issues/122) | Mesurer les erreurs de diagnostic |
| [PHY-126 · #127](https://github.com/NathanMuzay/Phytolie/issues/127) | Compléter report et suspension des rappels |
| [PHY-129 · #129](https://github.com/NathanMuzay/Phytolie/issues/129) | Tester les notifications sur appareils cibles |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **03/01/2027**.

## Sprint 7 — Mode vacances et délégation complète

**Dates : 04/01/2027 au 17/01/2027. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Des tâches déléguées par type, des rappels adressés au responsable et un parcours vacances validé de bout en bout.

**Ordre de travail :** Compléter PHY-132 avant routage PHY-135. Assurer refus/révocation et protections concurrentes PHY-136. Puis exécuter PHY-154 sur propriétaire et gardien, avec rappels et retour de vacances.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-132 · #132](https://github.com/NathanMuzay/Phytolie/issues/132) | Permettre le choix des types de tâches confiées |
| [PHY-135 · #135](https://github.com/NathanMuzay/Phytolie/issues/135) | Router les rappels vers le responsable |
| [PHY-136 · #136](https://github.com/NathanMuzay/Phytolie/issues/136) | Compléter actualisation propriétaire et validation des confirmations concurrentes |
| [PHY-154 · #154](https://github.com/NathanMuzay/Phytolie/issues/154) | Tester le scénario complet de vacances |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-139 · #140](https://github.com/NathanMuzay/Phytolie/issues/140) | Inventorier données collectées et prestataires |
| [PHY-017 · #17](https://github.com/NathanMuzay/Phytolie/issues/17) | Vérifier les chiffres de marché |
| [PHY-054 · #54](https://github.com/NathanMuzay/Phytolie/issues/54) | Compléter les préférences de compte demandées |
| [PHY-058 · #57](https://github.com/NathanMuzay/Phytolie/issues/57) | Ajouter quotas et suivi des coûts externes |
| [PHY-059 · #58](https://github.com/NathanMuzay/Phytolie/issues/58) | Ajouter logs, suivi d'erreurs et alertes |
| [PHY-137 · #137](https://github.com/NathanMuzay/Phytolie/issues/137) | Gérer refus, annulation et révocation |
| [PHY-147 · #148](https://github.com/NathanMuzay/Phytolie/issues/148) | Gérer indisponibilité des services externes |
| [PHY-149 · #149](https://github.com/NathanMuzay/Phytolie/issues/149) | Définir plan de tests et appareils de référence |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **17/01/2027**.

## Sprint 8 — Hors connexion, historique complet et sauvegardes

**Dates : 18/01/2027 au 31/01/2027. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un carnet consultable hors connexion, des soins resynchronisés sans perte, un historique complet et une restauration testée.

**Ordre de travail :** Définir les données consultables PHY-145 puis la file de synchronisation PHY-146. Compléter PHY-068 et valider compatibilité des anciennes collections. Tester coupures/conflits, nettoyage des photos et restauration PHY-060 ; préparer le canal de distribution.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-145 · #145](https://github.com/NathanMuzay/Phytolie/issues/145) | Permettre la consultation du carnet du compte sans réseau |
| [PHY-146 · #146](https://github.com/NathanMuzay/Phytolie/issues/146) | Ajouter file hors connexion, resynchronisation et résolution des conflits |
| [PHY-068 · #67](https://github.com/NathanMuzay/Phytolie/issues/67) | Compléter l'historique : scans santé, rempotages et changements de paramètres |
| [PHY-060 · #62](https://github.com/NathanMuzay/Phytolie/issues/62) | Configurer et tester sauvegardes et restauration |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-033 · #33](https://github.com/NathanMuzay/Phytolie/issues/33) | Créer les composants et états communs |
| [PHY-155 · #155](https://github.com/NathanMuzay/Phytolie/issues/155) | Tester réseau lent, coupure et redémarrage |
| [PHY-156 · #157](https://github.com/NathanMuzay/Phytolie/issues/157) | Tester accessibilité et tailles d'écran |
| [PHY-163 · #163](https://github.com/NathanMuzay/Phytolie/issues/163) | Préparer comptes et accès de distribution |
| [PHY-176 · #177](https://github.com/NathanMuzay/Phytolie/issues/177) | Vérifier les migrations et collections anciennes après ajout des nouveaux soins **(complément ajouté)** |
| [PHY-177 · #176](https://github.com/NathanMuzay/Phytolie/issues/176) | Vérifier le nettoyage des photos après archivage et suppression de l'historique **(complément ajouté)** |
| [PHY-178 · #178](https://github.com/NathanMuzay/Phytolie/issues/178) | Actualiser le guide utilisateur pour les fonctionnalités nouvellement livrées **(complément ajouté)** |
| [PHY-179 · #179](https://github.com/NathanMuzay/Phytolie/issues/179) | Tester les conflits de synchronisation des soins sur deux appareils **(complément ajouté)** |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **31/01/2027**.

## Sprint 9 — Production sécurisée et bêta

**Dates : 01/02/2027 au 14/02/2027. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Un environnement prêt à héberger une bêta, une revue de sécurité réalisée et des retours utilisateurs exploitables.

**Ordre de travail :** Préparer PHY-164 sans ouvrir une version non revue au public. Effectuer PHY-148 et PHY-153 ; corriger les problèmes bloquants de la bêta avant distribution PHY-158. Préparer collecte/alertes, puis tester avec le persona et mesurer les critères.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-164 · #164](https://github.com/NathanMuzay/Phytolie/issues/164) | Préparer l'environnement de production |
| [PHY-148 · #147](https://github.com/NathanMuzay/Phytolie/issues/147) | Faire une revue de sécurité et corriger |
| [PHY-153 · #153](https://github.com/NathanMuzay/Phytolie/issues/153) | Tester les parcours de bout en bout |
| [PHY-158 · #156](https://github.com/NathanMuzay/Phytolie/issues/156) | Distribuer la bêta aux testeurs |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-142 · #143](https://github.com/NathanMuzay/Phytolie/issues/143) | Rédiger confidentialité et conditions d'utilisation |
| [PHY-157 · #158](https://github.com/NathanMuzay/Phytolie/issues/158) | Mesurer performance, consommation et coût |
| [PHY-159 · #159](https://github.com/NathanMuzay/Phytolie/issues/159) | Tester avec des utilisateurs du persona |
| [PHY-160 · #161](https://github.com/NathanMuzay/Phytolie/issues/161) | Comparer résultats aux critères de qualité |
| [PHY-180 · #180](https://github.com/NathanMuzay/Phytolie/issues/180) | Vérifier l'installation bêta sur un téléphone sans données préexistantes **(complément ajouté)** |
| [PHY-181 · #181](https://github.com/NathanMuzay/Phytolie/issues/181) | Configurer la collecte et le triage des retours bêta **(complément ajouté)** |
| [PHY-182 · #183](https://github.com/NathanMuzay/Phytolie/issues/183) | Configurer les seuils et destinataires des alertes de production **(complément ajouté)** |
| [PHY-183 · #182](https://github.com/NathanMuzay/Phytolie/issues/182) | Documenter l'exploitation et la reprise après incident en production **(complément ajouté)** |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **14/02/2027**.

## Sprint 10 — Stabilisation, recette et livraison

**Dates : 15/02/2027 au 28/02/2027. Cible : 4 majeures et 8 mineures.**

**Résultat attendu :** Une version corrigée, signée, recettée et livrée, avec notes de version et suivi des incidents.

**Ordre de travail :** Traiter les retours dans PHY-161 puis rejouer PHY-162. Vérifier sauvegarde/rollback PHY-170. Produire PHY-168, effectuer PHY-173, puis soumettre/publier et livrer PHY-174. Notes, bilan, démonstration et suivi accompagnent cette livraison.

### 4 tâches majeures

| Issue | Travail restant |
|---|---|
| [PHY-161 · #160](https://github.com/NathanMuzay/Phytolie/issues/160) | Corriger les bugs bloquants et majeurs |
| [PHY-168 · #170](https://github.com/NathanMuzay/Phytolie/issues/170) | Produire la version candidate signée |
| [PHY-173 · #172](https://github.com/NathanMuzay/Phytolie/issues/172) | Effectuer la recette finale |
| [PHY-174 · #175](https://github.com/NathanMuzay/Phytolie/issues/175) | Livrer et créer le tag de release |

### 8 tâches mineures

| Issue | Travail restant |
|---|---|
| [PHY-162 · #162](https://github.com/NathanMuzay/Phytolie/issues/162) | Rejouer la non-régression |
| [PHY-167 · #165](https://github.com/NathanMuzay/Phytolie/issues/165) | Préparer captures et informations de distribution |
| [PHY-169 · #168](https://github.com/NathanMuzay/Phytolie/issues/168) | Soumettre aux stores si retenus |
| [PHY-170 · #169](https://github.com/NathanMuzay/Phytolie/issues/169) | Tester migration, sauvegarde et retour arrière |
| [PHY-171 · #173](https://github.com/NathanMuzay/Phytolie/issues/173) | Préparer la démonstration |
| [PHY-172 · #171](https://github.com/NathanMuzay/Phytolie/issues/171) | Rédiger bilan de validation et travaux restants |
| [PHY-175 · #174](https://github.com/NathanMuzay/Phytolie/issues/174) | Vérifier livraison et derniers incidents |
| [PHY-184 · #184](https://github.com/NathanMuzay/Phytolie/issues/184) | Rédiger les notes de version et le parcours de signalement après livraison **(complément ajouté)** |

**Validation de fin de sprint :** démontrer le résultat attendu, vérifier les critères des 12 issues et consigner les tâches réellement terminées. Date cible : **28/02/2027**.

## Dépendances entre les sprints

- S1 → S2 : modèle et droits avant catalogue, archivage, export et suppression.
- S2 → S3 : seuils de qualité et catalogue avant validation des recommandations.
- S3 → S4 : journal des soins et règles d'entretien avant rempotage.
- S4 → S5 : études de diagnostic et couverture santé avant intégration IA.
- S5 → S6 : scans et diagnostic avant suivi longitudinal et programmation.
- S6 → S7 : calendrier de tous les soins avant délégation par type et routage des rappels.
- S7 → S8 : règles de concurrence et autorisations avant synchronisation hors connexion.
- S8 → S9 : restauration, données compatibles et essais de coupure avant bêta.
- S9 → S10 : retours et mesures de qualité avant corrections finales et recette.

## Source et portée

Source des tâches et statuts : [issues ouvertes du dépôt](https://github.com/NathanMuzay/Phytolie/issues?q=is%3Aissue+is%3Aopen), consultées le 9 octobre 2026. Les statuts peuvent évoluer après cette consultation ; les sprints doivent alors être ajustés.

L'ordre, la cadence et les dates sont une proposition de planification. Les neuf compléments ont été créés pour couvrir les validations et documents des nouvelles fonctionnalités, conformément à l'autorisation d'ajouter des mineures. Aucun travail déjà clôturé n'est réintroduit.
