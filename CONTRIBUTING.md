# Contribuer à Phytolie

## Démarrer

Lire le [README](README.md), les [contrats partagés](src/shared/model.ts) et le [guide utilisateur](docs/USAGE.md). Utiliser Node 22 (`nvm use`), puis `npm ci` et `npm ci --prefix server`. Copier `.env.example` vers `.env` et renseigner uniquement les paramètres nécessaires. Ne jamais versionner `.env`, clés, bases SQLite ou données réelles.

## Branches et commits

- `main` contient la version de référence ; proposer les changements par pull request vers `main`.
- Créer une branche courte par sujet : `feat/PHY-089-arrosage-date`, `fix/PHY-065-restauration` ou `docs/PHY-011-contribution`.
- Utiliser `feat:`, `fix:`, `docs:`, `test:` ou `chore:` suivi d’un changement concret. Mentionner l’issue dans le commit ou la PR, avec son véritable numéro GitHub : celui-ci peut différer du numéro PHY du titre.
- Garder les commits ciblés. Éviter les changements de format sans lien avec la fonctionnalité.

Ces règles définissent le processus de l’équipe. Elles ne signifient pas qu’une protection de branche a été configurée dans GitHub.

## Développer et valider

Respecter les modules `src/features`, les utilitaires `src/shared` et les services `src/services`. Les contrats exécutés par l’API doivent rester compatibles avec Node 22 et ses imports TypeScript explicites `.ts`. Préserver la lecture des anciennes sauvegardes et la révision optimiste du jardin.

Avant une PR, lancer :

```sh
npm run typecheck
npm test
npm run test:api-runtime
npx expo export --platform web --platform android
```

Tester les parcours modifiés sur le Web et vérifier l’affichage à largeur mobile. Préciser les appareils réellement testés : un export Android ne remplace pas un essai sur téléphone. Pour une modification documentaire, indiquer la relecture effectuée. Ajouter des tests pour les changements de calcul, de persistance et d’autorisation ; mettre à jour le guide et la politique de confidentialité si les données changent.

## Pull request et revue

Remplir le modèle de PR : problème, résultat, référence d’issue, étapes de validation et limites. Fournir des captures pour un écran modifié sans données personnelles. Demander une revue à un autre membre lorsqu’il est disponible ; l’auteur répond aux remarques avant fusion. En travail individuel, relire le diff et noter cette situation dans la PR. Attendre les contrôles CI ; ne pas ignorer un échec sans justification.

Le relecteur vérifie les critères de l’issue, la compatibilité des données, les droits d’accès et les messages utilisateur. Fusionner après validation, puis supprimer la branche si elle n’est plus utile. Clore l’issue uniquement avec une preuve correspondant à sa version livrée. Une modification locale seule ne prouve pas un déploiement.

Pour un bug, utiliser le modèle d’issue et décrire la reproduction avec des données fictives. Ne pas publier de secret ou de donnée de compte dans les logs ou captures.
