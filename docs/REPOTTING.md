# Règles de substrat et de rempotage

## Décider après observation

L’aide de `src/features/plants/repotting.ts` considère cinq éléments :

| Élément | Utilisation et limite |
| --- | --- |
| Espèce | Rappelle le type de mélange conseillé par le profil d’espèce ; une espèce inconnue demande confirmation. |
| Racines | Racines serrées, tournant autour de la motte ou sortant du pot : examiner le besoin de place. Des racines non observées ne déclenchent pas de diagnostic. |
| Pot | Affiche diamètre, profondeur utile et drainage déclarés. Un grand pot seul n’est pas une preuve d’espace racinaire disponible. |
| Substrat | Affiche le mélange actuel et demande son état. Un tassement ou drainage dégradé invite à envisager son renouvellement, éventuellement dans le même pot. |
| Observations | Racines, structure et croissance sont choisies par l’utilisateur. Privilégier la croissance active si possible ; le calendrier seul ne permet pas de déduire la saison biologique. |

Si des racines à l’étroit ou un mélange dégradé sont signalés, l’aide propose d’envisager un rempotage **après inspection**. Sans ces signaux, elle invite à observer ; une date échue devient un contrôle de la motte. Aucun score de probabilité ni diagnostic racinaire automatique n’est produit. La date de contrôle ne force pas un rempotage.

Ces règles sont une traduction qualitative des conseils de la [Royal Horticultural Society sur le rempotage](https://www.rhs.org.uk/container-gardening/how-to-repot-a-plant). Elles ne calculent pas une fréquence universelle par espèce. La taille du nouveau pot reste confirmée par l’utilisateur après examen.

## Catalogue et provenance

Le catalogue structuré `substrates.ts` contient nom, composition indicative, propriétés et URL source. Les fiches prennent un instantané du mélange choisi pour que les changements restent lisibles. Le profil de rétention est transmis au moteur d’arrosage ; une composition manuelle ne fait pas l’objet d’une analyse chimique ou physique automatique.

- Les matériaux organiques des profils polyvalents s’appuient sur les [alternatives à la tourbe, RHS](https://www.rhs.org.uk/science/gardening-in-a-changing-world/peat-use-in-gardens/peat-alternatives).
- Le drainage demandé pour les plantes du groupe Sansevieria est illustré par le [guide RHS](https://www.rhs.org.uk/plants/sansevieria).
- Les propriétés des constituants (aération, drainage, rétention) sont décrites par [University of Connecticut, Potting Media](https://homegarden.cahnr.uconn.edu/factsheets/potting-media/).

Le choix de quatre catégories et les coefficients numériques déjà présents dans `irrigation.ts` sont des heuristiques de l’application. Les sources ne valident pas ces coefficients. Un produit inconnu ou un mélange maison conserve sa description utilisateur ; les compositions des profils ne prétendent pas décrire un sac réel.

## Index botanique

Les correspondances de recherche sont conservées dans `botanicalNames.ts` avec leurs sources : [Nephrolepis exaltata, UF/IFAS](https://ask.ifas.ufl.edu/publication/FP427), [Dracaena trifasciata, Kew](https://www.kew.org/plants/snake-plant), [Monstera deliciosa, RHS](https://www.rhs.org.uk/plants/swiss-cheese-plants/how-to-grow-swiss-cheese-plants). Le nom validé dans la fiche reste inchangé. Les noms équivalents suivent aussi le même profil d’entretien ; l’index comporte actuellement ces trois groupes et se complète par revue des sources.
