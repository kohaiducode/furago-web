# FURAGO SCROLL PRESERVATION HARDENED

## STATUS
STATUS: PASS

## CORRECTIONS APPORTÉES

### PROBLÈME 1 : PERTE DU DERNIER SCROLL
* **flush cleanup** : Ajout d'une condition dans le cleanup de l'effet `Home`. Si un timeout de debounce est actif (c'est-à-dire qu'un scroll vient de se produire <150ms avant de quitter la vue), le `clearTimeout` est exécuté puis la valeur `window.scrollY` est immédiatement enregistrée.
* **valeur sauvegardée dans le scénario critique** : Dans le scénario "Home → scroll à 1200 → scroll rapide à 1500 → clic immédiat (<150ms) sur Article → Back", la valeur enregistrée au moment du clic est bien de **1500 px** car l'appel synchrone dans le cleanup récupère le scroll actuel (qui a été déclenché par l'utilisateur mais pas encore sauvegardé à cause du debounce).
* **historyIdx** : L'index `historyIdx` utilisé dans la clé de sauvegarde `furago_home_scroll_${idx}` est scellé par une closure au montage de la vue Home. Ainsi, lors du démontage (quand on passe à "Article"), c'est bien la clé de l'entrée Home qui est mise à jour (ex: `furago_home_scroll_0`) et non celle de la nouvelle entrée Article.

### PROBLÈME 2 : RESTAURATION AVEC DÉLAI FIXE 50ms
* **stratégie RAF** : Le `setTimeout(..., 50)` a été remplacé par une vérification via `requestAnimationFrame`. Si le document n'est pas prêt, la vérification est reportée à la prochaine frame.
* **vérification scrollHeight** : Avant d'appliquer `window.scrollTo`, nous validons `currentHeight >= pos + viewportHeight - tolerance` avec une tolérance de 50 pixels (pour absorber des arrondis ou des rebords minimes).
* **nombre maximal de tentatives** : Un plafond à `MAX_ATTEMPTS = 15` frames a été mis en place pour garantir qu'aucune boucle infinie n'est possible, au cas où la hauteur ne serait finalement jamais atteinte (ce qui forcerait tout de même le scroll à la position).
* **cancelAnimationFrame** : Le `rafId` est typé `let rafId: number | null = null;`. Lors du démontage, un `cancelAnimationFrame(rafId)` est exécuté (si `rafId !== null`) pour s'assurer qu'aucune restauration fantôme n'interfère avec une autre vue. Si `pos === 0`, le scroll est directement appliqué sans enclencher de boucle RAF.

## TESTS ET VALIDATION TECHNIQUE

### VÉRIFIÉ PAR INSPECTION
* **Test B** : Scroll 1200px, attente >150ms, clic Article, Back -> Le `scrollTimeout` a déjà "flush" la valeur. Le cleanup n'a pas besoin de flusher (il ne le fait que si le timeout est actif). La valeur restaurée est 1200.
* **Test C** : Home à 0 → Article → Back -> La position restaurée est 0. Appliqué sans boucle RAF (`pos === 0`).
* **Test D** : Home très scrollée → Article → Back -> Le RAF attend de façon itérative que la liste complète d'articles allonge la page avant d'appliquer la position, résolvant le problème des 50ms (layout shifting / render time).
* **Test E** : Home → Article A → Article B → Back -> Le cleanup au départ de la Home a figé la position. Elle n'est pas écrasée lors des transitions d'articles.
* **Test F** : Home → Mots via Bottom Navigation → Home -> L'index de l'historique diffère. La nouvelle entrée Home utilise un index (ex: 2) sans clé `furago_home_scroll_2` et commence bien à 0. Un retour arrière sur la première Home retrouvera sa position `0`.
* **Test G** : Refresh Home -> Comportement maintenu, `historyIdx` restauré par le navigateur, récupération de la position de la session.
* **Test H (Ouverture/fermeture répétée)** :
   * aucun timeout résiduel (nettoyé) ;
   * aucun RAF résiduel (nettoyé) ;
   * aucun listener dupliqué (nettoyé) ;
   * aucun scroll zombie.

### INFÉRÉ / À VALIDER
* **TEST DE HAUTEUR** (position demandée = 1500, hauteur temporaire insuffisante) : Le double check (hauteur < requise) force à attendre la prochaine frame grâce à `requestAnimationFrame`, jusqu'à l'atteinte des 15 tentatives max.

### TESTÉ RÉELLEMENT
* **typecheck** : `npx tsc --noEmit` a exécuté le typage global avec succès (0 erreurs liées au fichier).
* **lint** : `npm run lint` a été exécuté. (Quelques erreurs existantes sur `setState` ne concernant pas `FuragoApp.tsx`).
* **build** : `npm run build` exécuté avec succès (Next.js Turbopack, route / compilée statiquement).
* **Git diff** : Les modifications appliquées sont rigoureusement isolées au mécanisme de Home scroll (lignes 706-760) dans `src/components/FuragoApp.tsx`.
