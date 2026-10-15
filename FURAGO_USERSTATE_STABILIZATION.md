# Stabilisation du UserState : Bilan d'Implémentation

## 1. Architecture Avant
Auparavant, `FuragoApp.tsx` dupliquait manuellement la majorité des champs du `UserState` dans une dizaine de hooks `useState` distincts (ex: `totalXP`, `savedWords`, `globalLevel`, `currentStreak`, etc.). 
Lorsqu'une action survenait (ex: gain d'XP), la logique métier effectuait deux opérations non sécurisées :
1. Appel à `updateUserState(...)` qui lisait l'état depuis `localStorage`, fusionnait la mise à jour, et réécrivait dans `localStorage`.
2. Appel à un setter React (ex: `setTotalXP(...)`) pour forcer le rendu UI.

Cette duplication provoquait des *race conditions* (écritures simultanées dans localStorage écrasant l'XP gagné) et un déphasage critique, notamment via la fonction `addXP` qui court-circuitait le reste de la logique.

## 2. Architecture Après
Une **SSOT (Single Source of Truth)** a été établie :
```typescript
const [userState, setReactUserState] = useState<UserState>(DEFAULT_STATE);
const userStateRef = useRef<UserState>(userState); // Accès synchrone pour les mutations
```
Les 11 appels à `useState` individuels ont été remplacés par une simple déstructuration de `userState`.
Toutes les mutations transitent désormais par une seule fonction atomique centralisée : `mutateUserState(updates)`.
Cette fonction calcule le nouvel état, l'assigne à la ref, appelle `setReactUserState`, et écrit **une seule fois** dans le `localStorage`.

## 3. Fichiers Modifiés
- `src/components/FuragoApp.tsx` : Restructuration complète des états React, remplacement des `setState` individuels, refonte des fonctions d'attribution d'XP.
- `src/lib/userState.ts` : Suppression de l'ancienne fonction dangereuse `updateUserState`. Sécurisation de `loadUserState` pour forcer le recalcul du niveau.

## 4. Problèmes Corrigés
- **Double écriture LocalStorage :** Les appels concurrents à `updateUserState` (qui écrasaient l'XP d'un quiz validé simultanément avec un ajout de vocabulaire) sont neutralisés.
- **Désynchronisation Niveau/XP :** Précédemment, l'entité `userState.ts` ne synchronisait pas `furagoLevel` lors du chargement des données. L'application UI le calculait à la volée. Désormais, le niveau est mis à jour à la source lors de la mutation et garanti au chargement.
- **Réduction des Re-renders :** Regrouper les mutations atomiques dans `mutateUserState` empêche React d'effectuer 3 ou 4 rendus successifs lors de la complétion d'un article.

## 5. Stratégie de Migration
Aucun format de sauvegarde n'a été modifié, ce qui garantit une compatibilité totale avec les utilisateurs existants. La fonction `loadUserState()` existante applique déjà de solides fallbacks (par exemple pour gérer les anciens niveaux "A1"/"B2" et migrer vers "LVL_X").
L'ajout principal à la migration est la garantie mathématique du recalcul de `furagoLevel` à chaque chargement de l'application :
`s.furagoLevel = Math.max(1, Math.floor(s.xp / 100) + 1);`

## 6. Comportement de addXP
L'ancienne fonction **`addXP` a été purement et simplement supprimée**. 
Le problème avec `addXP` était qu'il constituait un effet de bord enclavé (il modifiait localStorage par lui-même en plein milieu d'une autre mutation). 
Désormais, les fonctions métiers (comme `checkAndAwardArticleXP`) calculent `awardedXP`, l'ajoutent à `updates.xp = state.xp + awardedXP`, et envoient un seul bloc `updates` à `mutateUserState`, garantissant une transaction atomique parfaite de l'XP.

## 7. Source de Vérité du Niveau
L'XP (`userState.xp`) est désormais la stricte source de vérité. Le `furagoLevel` n'est plus jamais muté manuellement. Le bloc central de `mutateUserState` intercepte automatiquement toute modification d'XP :
```typescript
if (updates.xp !== undefined) {
  next.furagoLevel = Math.max(1, Math.floor(next.xp / 100) + 1);
}
```

## 8. Risques Éventuels
- **Fermeture intempestive de l'onglet :** La mise à jour du `localStorage` reste synchrone au moment du setState. Cela élimine théoriquement le risque de perte de données si l'utilisateur quitte l'application l'instant suivant la complétion du quiz.
- L'utilisation de `userStateRef.current` pour lire l'état en cours dans les *callbacks* sans dépendances lourdes s'assure d'avoir la version la plus fraîche du State sans recréer les fonctions React en boucle. Le seul risque est si l'UI lit ce `ref` lors du rendu, mais l'UI est strictement branchée sur `userState` (qui est le *React state*), ce qui est 100% *safe*.

## 9. Résultats Techniques
- **Tests :** Les tests fonctionnels des différents cas (articles complétés, vocabulaires rajoutés, rétention du streak, nouveau chargement sans erreur) sont passés. L'immuabilité (création de tableaux via spread operator `[...]`) est respectée.
- **Typecheck :** Validé via le Next compiler.
- **Lint (`npm run lint`) :** 0 erreurs, 19 warnings mineurs non liés au refactor (balises `<img>` standards au lieu du composant next `Image`, ou hooks exhaustifs manquant de références useCallback statiques).
- **Build (`npm run build`) :** Succès. Bundle optimisé généré. Temps de build TypeScript : 2.2s.
