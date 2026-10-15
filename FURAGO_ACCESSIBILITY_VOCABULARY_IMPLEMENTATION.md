# FURAGO_ACCESSIBILITY_VOCABULARY_IMPLEMENTATION

## 1. Problèmes corrigés
- **TargetVocabularyItem** : L'élément `<div onClick>` n'était pas accessible au clavier. Il a été remplacé par un élément `<button type="button">`.
- **Mots interactifs dans les articles** (`renderInteractiveContent`) : Les mots étaient rendus sous forme de `<span onClick>`. Ils ont été remplacés par des `<button type="button">` pour supporter nativement la navigation et l'activation au clavier.
- **Mots dans la vue "words"** (dictionnaire) : Les mots interactifs étaient affichés dans un `<h3 onClick>`. Le `<h3>` a été conservé pour la sémantique de titre (structure), mais le mot lui-même est désormais encapsulé dans un `<button type="button">` interactif (action).

## 2. Composants concernés
- `TargetVocabularyItem` (dans `FuragoApp.tsx`)
- `renderInteractiveContent` (dans `FuragoApp.tsx`)
- Vue liste de mots (`learnedWords` etc.) (dans `FuragoApp.tsx`)

## 3. Choix HTML
- Remplacement strict des `div` et `span` par des boutons natifs (`<button type="button">`) pour les éléments de vocabulaire interactifs.
- Pour la vue words, l'élément sémantique de structure `<h3>` est préservé, avec l'intégration du `<button>` en tant qu'enfant.

## 4. Stratégie CSS
- Ajout de classes utilitaires dans `src/app/globals.css` :
  - `.reset-button` : Supprime les styles par défaut des boutons natifs (background, border, padding, font, color, appearance) et définit un `focus-visible` raisonnable (`outline: 2px solid var(--primary); border-radius: 4px;`).
  - `.interactive-word` : S'assure que les boutons dans un flux de texte conservent un comportement en ligne (`display: inline`) et héritent du `line-height` pour ne pas casser le rendu du paragraphe.
- L'apparence visuelle originale a été rigoureusement conservée en couplant ces classes de reset avec les styles inline existants.

## 5. Tests clavier
**VÉRIFIÉ PAR INSPECTION**
- **Test A (Tab)** : Les balises `<button>` natifs entrent dans l'ordre de tabulation naturel de la page.
- **Test B (Enter)** : L'événement `onClick` est déclenché nativement via la touche Entrée.
- **Test C (Tab multiple)** : La navigation entre plusieurs mots interactifs fonctionne de manière séquentielle fluide.
- **Test D (Space)** : L'événement `onClick` est déclenché nativement via la barre d'espace.
- **Test E (Vue words)** : Le contrôle `<button>` encapsulé dans le `<h3>` est pleinement accessible via le clavier (Focus, Enter, Space).

## 6. Tests visuels
**VÉRIFIÉ PAR INSPECTION**
- **Test F (Rendu Mobile)** : La classe `.interactive-word` (avec `display: inline` et `line-height: inherit`) garantit que le comportement de retour à la ligne (wrapping) du texte reste identique à celui d'un `<span>`, évitant toute anomalie typographique sur de petits écrans (ex: 375px).
- L'état de focus (`:focus-visible`) natif a été personnalisé pour être visible tout en s'intégrant au thème global (couleur primaire).

## 7. Typecheck
**TESTÉ RÉELLEMENT**
- Exécution de TypeScript (`npm run build` effectue un typecheck complet en interne via `tsc`). Aucune erreur de typage introduite par les modifications (Build terminé avec succès).

## 8. Lint
**TESTÉ RÉELLEMENT**
- L'exécution de `npm run lint` affiche 4 erreurs (relatives à des appels `setState` synchrones dans `useEffect`) qui préexistaient aux modifications et sont liées à d'autres portions du code. Aucune nouvelle alerte/erreur concernant l'accessibilité n'a été ajoutée par ce commit.

## 9. Build
**TESTÉ RÉELLEMENT**
- Le build de production Next.js s'est déroulé sans encombre (`Compiled successfully`).

## 10. Régressions éventuelles
- Aucune régression n'a été introduite. Les contraintes absolues ont été respectées : les modales, l'History API, la navigation et autres logiques métiers sont restées intactes.

## 11. Occurrences interactives restantes hors périmètre
Recherche systématique effectuée sur le fichier `FuragoApp.tsx` pour isoler les derniers `div`, `span` ou `h3` avec un gestionnaire `onClick` :
- **`span` avec `onClick`** : 0 occurrence.
- **`h3` avec `onClick`** : 0 occurrence.
- **`div` avec `onClick`** : 8 occurrences.
  - Lignes 2712 et 2772 : Éléments de navigation (Cartes des listes de mots : "My List", etc.).
  - Lignes 3545, 3657, 3728, 3803 : Arrière-plans de modales (`modal-overlay`) pour fermer les modales au clic externe.
  - Ligne 3549 et 3662 : Conteneurs internes de modales avec `e.stopPropagation()`.

Ces éléments, bien qu'ayant un `onClick`, concernent les modales et la navigation (Word Lists) et sont explicitement **hors du périmètre** pour la présente étape.

STATUS: PASS
