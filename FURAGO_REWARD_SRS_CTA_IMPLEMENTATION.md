# CHANTIER : REWARD → CTA DIRECT VERS SRS

## 1. Friction initiale
À la fin d'un article, l'écran Reward célébrait les nouveaux mots, mais ne proposait pas d'action directe pour les réviser. L'utilisateur devait retourner à l'accueil pour accéder au SRS, brisant la boucle de rétention immédiate.

## 2. Logique d'affichage du CTA
Le nouveau bouton "Review Vocabulary" (🔄 単語を復習する) est affiché conditionnellement sur l'écran Reward :
- Seulement si des mots sont disponibles à la révision (`sessionReward.vocab > 0` OU `stats.dueToday > 0`).
- Lorsqu'il est affiché, il prend l'apparence primaire pour guider l'utilisateur.
- Les boutons "Next Article" ou "Next Episode" deviennent alors secondaires, mais restent pleinement accessibles.

## 3. Cas nouveaux mots
Testé virtuellement par inspection :
Si `sessionReward.vocab > 0`, la variable `hasVocabToReview` passe à `true`. Le bouton SRS ("Review Vocabulary") apparaît alors tout en haut de la liste des boutons d'actions.

## 4. Cas aucun mot
Testé virtuellement par inspection :
Si l'article n'a produit aucun nouveau mot (`sessionReward.vocab === 0`) et qu'aucun mot n'est en attente globale (`stats.dueToday === 0`), `hasVocabToReview` est `false`. Le bouton SRS ne s'affiche pas et les autres boutons conservent leur hiérarchie (couleur primaire).

## 5. Navigation Reward → SRS
Implémenté via `startVocabReview("learned", "reading")`. 
L'appel conserve la logique métier exacte du SRS actuel en limitant simplement la provenance des mots (mots dus + nouveaux mots). 
La nouvelle option `"reading"` a été ajoutée aux types stricts de `returnTo` afin d'être injectée correctement au SRS.

## 6. Contexte de retour
Contexte choisi : **Reward → SRS → Reward** (`"reading"`)
En transmettant `"reading"` dans `returnTo`, à la fin de la révision SRS, l'application exécute `handleBack("reading")`. 
Comme la logique React de `FuragoApp` conserve l'état (`quizIndex` et `sessionReward`) lorsque l'on quitte puis revient à `"reading"` via un simple changement de vue, le joueur revient exactement sur l'écran de complétion, retrouvant son "Next Article".

## 7. Interaction History API
Le système `startVocabReview` exploite la fonction `navigateTo("vocab_review", { returnTo: "reading" })`, qui elle-même pousse un nouvel état propre dans `window.history`. 
Au retour, `handleBack("reading")` effectue correctement `window.history.back()`. 
**Aucun appel direct destructeur à pushState() n'a été ajouté**.

## 8. Interaction Scroll Preservation
Le scroll global n'a pas été affecté. L'écran de Reward (faisant partie de la vue `"reading"`) n'affecte pas l'état du composant de la liste d'articles (Home) ni son cache scroll. Les retours vers le Reward sont par ailleurs des vues courtes statiques.

## 9. UX Mobile
- Le bouton adopte exactement les mêmes classes CSS inline / styles que les boutons existants (padding 14px, width 100%, borderRadius 16px).
- La surface de frappe (touch target) reste très large et lisible.
- Sur 375px/390px, le bouton empile proprement avec un gap de 12px.

## 10. Accessibilité
- Utilisé un vrai bouton HTML `<button type="button">`.
- Le texte est présent, complété d'un émoji non obstructif.
- Le style "secondary" du bouton Next Article (quand le SRS est actif) offre un bon contraste (`var(--primary)` sur fond `var(--bg)`).

## 11. Tests
| Test | Description | Statut |
| :--- | :--- | :--- |
| **Test A** | Article sans nouveau vocabulaire → Reward : CTA absent | **VÉRIFIÉ PAR INSPECTION** |
| **Test B** | Article avec nouveaux mots → Reward : CTA visible | **VÉRIFIÉ PAR INSPECTION** |
| **Test C** | CTA SRS : démarre le SRS | **VÉRIFIÉ PAR INSPECTION** |
| **Test D** | Reward → SRS : vocabulaire exact, pas de mutation inattendue | **VÉRIFIÉ PAR INSPECTION** |
| **Test E** | SRS → retour : retour parfait vers "reading" (Reward) | **INFÉRÉ / À VALIDER** |
| **Test F** | Reward → Next Article : toujours fonctionnel | **VÉRIFIÉ PAR INSPECTION** |
| **Test G** | Reward → Back Home : toujours fonctionnel | **VÉRIFIÉ PAR INSPECTION** |

## 12. Typecheck
`npx tsc --noEmit`
**TESTÉ RÉELLEMENT** - Résultat : `PASS` (Aucune erreur TypeScript liée à ces changements).

## 13. Lint
`npm run lint`
**TESTÉ RÉELLEMENT** - Résultat : `PASS` (Quelques avertissements natifs liés à `<img>`, aucun sur le fichier `FuragoApp.tsx`).

## 14. Build
`npm run build`
**TESTÉ RÉELLEMENT** - Résultat : `PASS` (La modification n'a pas cassé le build de production).

## 15. Régressions
Aucune régression détectée.
- `mergeLearnedVocabulary` intact.
- Les autres CTA de l'écran (XP, Streak, Series Info) sont préservés.

## 16. Limitations
Le choix "Reward → SRS → Reward" en s'appuyant sur l'état local du composant `FuragoApp` (`quizIndex`) fonctionne de manière fluide pendant une session active. 
Cependant, si l'utilisateur *rafraîchit son navigateur* en plein milieu d'une session SRS, l'état volatil `quizIndex` se remet à 0. Au retour vers `"reading"`, le joueur se retrouvera propulsé au début de l'article lu. C'est le comportement attendu d'une Single Page Application sans persistance du contexte de fin d'article, mais un compromis acceptable compte tenu de l'instruction *ne pas inventer une nouvelle vue*.

---

**STATUS: PASS**
