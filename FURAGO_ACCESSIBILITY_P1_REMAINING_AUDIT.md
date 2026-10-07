# Audit Accessibilité P1 : Éléments Interactifs & Labels

## 1. Executive Summary

L'audit révèle que les améliorations d'accessibilité précédentes (modales, targets) sont bien en place. La majorité des éléments interactifs du projet (notamment les mots cliquables) ont été correctement convertis en éléments `<button>`. Toutefois, **6 problèmes de niveau P1** subsistent dans les catégories ciblées, empêchant une navigation au clavier fluide et limitant l'utilisation par les lecteurs d'écran.

## 2. Article Cards

| Fichier | Composant | Ligne | Élément | Problème | Sévérité | Correction recommandée |
| ------- | --------- | ----: | ------- | -------- | -------- | ---------------------- |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Vue Explore) | ~2367 | `<li onClick={...}>` | Carte d'article non accessible au clavier (aucun rôle, pas de tabIndex, pas d'event clavier Enter/Space). | P1 | Remplacer l'élément interactif par un `<button>` à l'intérieur du `<li>`, ou convertir le `<li>` avec `role="button"`, `tabIndex={0}` et gérer `onKeyDown`. Privilégier le `<button>`. |

## 3. List Selectors

| Fichier | Composant | Ligne | Élément | Problème | Sévérité | Correction recommandée |
| ------- | --------- | ----: | ------- | -------- | -------- | ---------------------- |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Vue Words) | ~2866 | `<div onClick={...}>` | Sélecteur de la liste système (Learned words) non accessible au clavier. | P1 | Remplacer le `<div>` par un `<button>` (avec reset des styles) ou ajouter les attributs interactifs adéquats. |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Vue Words) | ~2927 | `<div onClick={...}>` | Sélecteur des listes personnalisées non accessible au clavier. | P1 | Remplacer le `<div>` par un `<button>`. |

## 4. Form Fields

| Fichier | Composant | Ligne | Élément | Problème | Sévérité | Correction recommandée |
| ------- | --------- | ----: | ------- | -------- | -------- | ---------------------- |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Top Lead Bar) | ~1995 | `<input type="email">` | Champ email sans nom accessible (seul un placeholder est présent). | P1 | Ajouter `aria-label="Adresse email"` ou associer un `<label>` visuellement masqué (sr-only). |
| `src/components/FuragoApp.tsx` | `FuragoApp` (New List Modal) | ~3995 | `<input type="text">` | Champ nom de la liste sans nom accessible explicite. | P1 | Ajouter `aria-labelledby="new-list-title"` (qui est l'id du titre de la modale). |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Lead Modal) | ~4171 | `<input type="text">` | `<label>` visuel présent mais non associé programmatiquement (pas de `htmlFor`/`id`). | P1 | Ajouter un `id="lead-first-name"` sur l'input et `htmlFor="lead-first-name"` sur le label. |
| `src/components/FuragoApp.tsx` | `FuragoApp` (Lead Modal) | ~4203 | `<input type="email">` | `<label>` visuel présent mais non associé programmatiquement (pas de `htmlFor`/`id`). | P1 | Ajouter un `id="lead-email"` sur l'input et `htmlFor="lead-email"` sur le label. |

## 5. False Positives / Éléments déjà corrects

Les éléments interactifs suivants ont été inspectés et sont déjà implémentés correctement (utilisation de boutons natifs) :
- **TargetVocabularyItem** (~ligne 117) : Utilise un `<button>` natif.
- **Mots interactifs dans le texte (Reading View)** (~ligne 1763) : Utilisent des `<button type="button">`.
- **Cartes d'articles recommandés (Home View)** (~ligne 2309) : Le conteneur est un `<li>` avec un `<button>` cliquable à l'intérieur.
- **Mots dans la vue des listes (Words View)** (~ligne 3102) : Utilisent des `<button>`.
- **Sélecteur de liste dans la modale d'ajout** (~ligne 3924) : Utilise des `<button>`.

Aucune correction n'est requise pour ces éléments.

## 6. Correctifs minimaux recommandés

1. **Article Cards & List Selectors** :
   - Remplacer les balises sémantiques (ou neutres comme `div`) interactives par des `<button type="button">`.
   - Maintenir la structure sémantique en plaçant les `<button>` à l'intérieur des `<li>` pour les listes.
   - Ajouter une classe de "reset" (ex: `background: 'none', border: 'none', padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer'`) pour préserver les styles actuels tout en récupérant le focus clavier et le déclenchement natif avec Enter/Space.

2. **Inputs** :
   - Ajouter `id` sur les inputs et `htmlFor` sur les labels adjacents (Lead Modal).
   - Utiliser `aria-label` ou `aria-labelledby` pour les inputs orphelins (Lead Bar et New List Modal).

## 7. Risques de régression

- **Style natif des boutons** : Le remplacement par `<button>` peut introduire des styles par défaut du navigateur (bordures, padding, font-family). Assurez-vous d'appliquer les resets CSS existants (ex: classes utilitaires déjà présentes dans le projet).
- **Flexbox / Grid** : Changer la balise de flex-container peut parfois affecter l'alignement ou l'étirement (width: 100%).
- **Propagation d'événements** : Bien que mineur, s'assurer que les boutons natifs ne soumettent pas accidentellement des formulaires (`type="button"` essentiel hors des formulaires).

## 8. Ordre d'implémentation

1. Champs de formulaires de la modale "Lead Modal" (`htmlFor` / `id`) - Très rapide, fort impact, risque nul.
2. Champs de formulaires orphelins (Lead Bar / New List) - Très rapide, risque nul.
3. List Selectors (Words View) - Facilement modifiables avec une balise `<button>`.
4. Article Cards (Explore View) - Plus de surface, nécessite un test minutieux de l'UI pour vérifier que l'imbrication `<li> > <button>` ne casse pas la grille ou le Flexbox existant.
