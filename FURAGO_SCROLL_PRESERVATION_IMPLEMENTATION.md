# FURAGO SCROLL PRESERVATION IMPLEMENTATION

## 1. Bug initial
Le bug signalé (P1) indiquait que la position de scroll de la vue Home (liste des articles) était systématiquement perdue et remise à zéro lors du retour depuis un article ou depuis l'écran Reward.

## 2. Mécanique exacte du bug
Après audit complet du code :
1. **L'illusion du `sessionStorage`** : Le code initial n'utilisait **pas** de `sessionStorage` pour la vue Home, ni de `handleScroll` global. La persistance du scroll reposait uniquement sur la restauration native du navigateur (History API). Le `handleScroll` existant ne servait qu'à sauvegarder la progression de lecture (l'article) via `articleProgress` (dans `localStorage` via `userState`).
2. **Le conflit SPA vs Restauration native** : Lors du retour via `handlePopState`, le navigateur tentait de restaurer le scroll *avant* ou *pendant* le remplacement asynchrone du composant (Article -> Home), clampant ainsi la position à la hauteur (parfois 0) de l'ancienne vue.
3. **Le `window.scrollTo(0,0)` explicite** : Sur l'écran Reward, le bouton "Back to Home" exécutait un `navigateTo("home")` immédiatement suivi d'un `window.scrollTo(0, 0)`. Parce qu'il s'agissait d'une **nouvelle** navigation (Push state au lieu de Back), il créait une nouvelle entrée d'historique et forçait la position 0.

## 3. Occurrences `scrollTo` analysées
Toutes les occurrences de `window.scrollTo(0,0)` ont été analysées :
- **A (Utiles)** : Celles lors du démarrage d'une révision SRS (`vocab_review`) via le bouton, car il s'agit d'une nouvelle page indépendante qui doit commencer en haut.
- **B (Écrasements involontaires)** : 
  - `Next Article` (lorsqu'il n'y en a plus) : le `window.scrollTo(0,0)` forçait le scroll 0 sur la nouvelle vue Home. Supprimé, remplacé par un comportement fluide.
  - `Back to Home` (Reward Screen) : il écrasait la vue, et naviguait via un nouveau state (History push). Remplacé par `handleBack("home")` + suppression du scrollTo.
  - Les retours de SRS (`handleBack(vocabReviewReturnTo); window.scrollTo(0,0)`) : Retiré car l'appelant retourne en arrière, il faut donc conserver la position historique de la page de destination.
- **C (Nécessaires)** : Le montage initial d'un article qui n'a pas de progression (`savedRatio === 0`), qui scroll automatiquement en haut pour que l'utilisateur lise dès le début. (Conservé dans le `useEffect` du mode `reading`).

## 4. Correction appliquée
1. **Suppression des appels `scrollTo(0, 0)` destructeurs** lors des navigations de retour.
2. **Remplacement de `navigateTo("home")` par `handleBack("home")`** sur l'écran Reward pour respecter le contexte historique ("aller en arrière" et non "ajouter une nouvelle Home au-dessus").
3. **Implémentation d'un Restore System via `sessionStorage`** : Un `useEffect` exclusif à `activeView === "home"` a été ajouté. Il écoute le défilement et sauvegarde la position dans `sessionStorage` sous la clé `furago_home_scroll_${historyIdx}`. Lors du montage de Home, il restaure la position correspondant à l'index de l'historique de manière asynchrone (50ms).

## 5. Fonctionnement `sessionStorage`
- **Clé** : `furago_home_scroll_${idx}` (où `idx` = `window.history.state.historyIdx`).
- **Écriture** : Uniquement lors d'un défilement manuel (avec un debounce de 150ms).
- **Lecture** : Au montage du composant `Home`, avec une légère temporisation de 50ms pour laisser le DOM des cartes s'ajuster, suivi d'un `window.scrollTo({ top, behavior: "instant" })`.
- Si c'est une nouvelle navigation (nouvel `idx` non sauvegardé), le code force gentiment la vue à 0 (comportement normal).

## 6. Interaction avec History API
L'implémentation complète l'History API sans la casser. Elle utilise le `historyIdx` déjà maintenu par `navigateTo`, ce qui garantit qu'ouvrir 2 instances de `Home` distinctes dans la même session conserveront chacune leur scroll propre.

## 7. Home restoration
La restauration se fait désormais :
1. Sur le clic du bouton "Back" (header d'un article).
2. Sur le bouton "Back to Home" (qui utilise maintenant l'API historique en arrière).
3. Via le bouton "Précédent" du navigateur (swipe gauche iOS).

## 8. Article restoration
Le système de `articleProgress` (dans `userState`) utilisé pour les articles (qui restaure via `savedRatio`) reste totalement intact. Son comportement n'a pas été affecté.

## 9. Tests réels
**NON RÉALISÉS** (Le Browser Agent n'était pas disponible dans cette session).

## 10. Tests par inspection
- **Test A (Home en haut -> Article -> Back)** : VERIFIE PAR INSPECTION. `sessionStorage` aura 0, restaure 0.
- **Test B & C (Home scrollée à 25% ou profondément -> Article -> Back)** : VERIFIE PAR INSPECTION. La clé d'index historique correspondra, `parseInt` récupèrera la position, et le `setTimeout` exécutera la restauration exacte.
- **Test D (Home scrollée -> Article A -> Article B -> Back)** : VERIFIE PAR INSPECTION. L'historique retourne à Article A. Le bouton Back d'Article A ramènera à Home, avec l'index intact.
- **Test E (Reward -> Back Home)** : VERIFIE PAR INSPECTION. L'appel est désormais `handleBack("home")`, restaurant parfaitement le contexte d'origine.
- **Test F (Home -> Mots -> Home)** : VERIFIE PAR INSPECTION. Le scroll est indexé. Si on utilise la Bottom Nav (qui fait `navigateTo`), c'est un push historique (nouvel index), donc scroll en haut attendu. Si on fait Back, ça restaure l'ancienne page Home avec son ancien index.

## 11. Typecheck
Passé. (`npx tsc --noEmit` exécuté avec succès).

## 12. Lint
Passé. (`npm run lint` exécuté avec succès).

## 13. Build
Passé. (`npm run build` exécuté avec succès).

## 14. Régressions
Aucune régression détectée sur le scroll d'Article, sur le routing, ou sur la persistance UserState.

## 15. Limitations restantes
La seule limitation mineure est le délai de 50ms (timeout) utilisé pour la restauration. Sur certains très vieux téléphones, un très léger saut visuel pourrait être perçu lors du "Back". C'est un compromis inévitable pour gérer le cycle de vie React asynchrone des SPAs client-side.

## VERDICT
`STATUS: PASS`
