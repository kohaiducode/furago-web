# FURAGO SCROLL PRESERVATION HARDENING

## 1. Debounce analysis
**INFERE / A VALIDER (via code review)**
Le système actuel utilise un écouteur d'évènement `scroll` avec un debounce de `150ms` via `setTimeout`. 
Lorsqu'un utilisateur scrolle, le `scrollTimeout` est réinitialisé et attend 150ms avant d'écrire la position dans le `sessionStorage`. 
Cependant, lors du démontage du composant Home (changement de `activeView`), la fonction de nettoyage (`cleanup`) de l'effet est appelée :
```tsx
return () => {
  window.removeEventListener("scroll", handleHomeScroll);
  if (scrollTimeout) clearTimeout(scrollTimeout); // DOMMAGE !
};
```
**Conclusion :** Si l'utilisateur clique sur un article moins de 150ms après son dernier mouvement de scroll, le `clearTimeout` annule la sauvegarde en attente. La position finale n'est jamais écrite.

## 2. Unmount analysis
**VERIFIE PAR INSPECTION**
Comme démontré ci-dessus, le démontage du composant écrase la transaction de sauvegarde en cours sans la "flusher".
**Correction minimale recommandée :** 
Ajouter un enregistrement synchrone de la position actuelle juste avant d'effacer le timeout dans le `cleanup`.
```tsx
return () => {
  window.removeEventListener("scroll", handleHomeScroll);
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
    // Flush immédiat avant de mourir
    const currentIdx = window.history.state?.historyIdx || 0;
    sessionStorage.setItem(`furago_home_scroll_${currentIdx}`, window.scrollY.toString());
  }
};
```

## 3. Restore timing analysis
**INFERE / A VALIDER**
Le code utilise `setTimeout(..., 50)` pour attendre que le DOM soit rendu avant de scroller. 
Bien que le catalogue d'articles soit présent en mémoire (`initialArticles` passé au composant racine), le rendu React complet d'une longue liste de composants `<ArticleCard>` peut nécessiter plus de temps sur des téléphones anciens ou limités en CPU. 
Si le délai de 50ms s'écoule *avant* que le navigateur n'ait fini de calculer le layout (Layout/Reflow) et peint la longue liste, la hauteur totale du document sera insuffisante et le `window.scrollTo` sera clampé à 0.
**Stratégie plus robuste :**
Utiliser `requestAnimationFrame` (idéalement double-RAF pour s'assurer du paint) ou migrer la logique de restauration dans un `useLayoutEffect` qui est garanti de s'exécuter de façon synchrone *après* la mise à jour du DOM mais *avant* le paint, garantissant que la hauteur est exacte.

## 4. Async catalog analysis
**VERIFIE PAR INSPECTION**
Le catalogue est pré-récupéré côté serveur dans `src/app/page.tsx` (`await getArticles()`) et passé de manière synchrone comme prop `initialArticles`. Il n'y a donc pas de phase de `loading` asynchrone sur la vue Home lors d'un retour "Back", ce qui minimise le risque que le délai de 50ms rate les données. Toutefois, le temps de rendu CPU reste un risque non déterministe.

## 5. History index analysis
**VERIFIE PAR INSPECTION**
La clé utilisée est `furago_home_scroll_${idx}`. 
- **Home → Article → Back :** Stable. `history.back()` réduit l'index à sa valeur d'origine.
- **Refresh :** Stable. Le navigateur conserve le state et le `historyIdx` lors d'un F5.
- **Deep Link :** Stable. Le premier load a `historyIdx` indéfini (qui devient `0`), les navigations suivantes incrémentent.
- **Plusieurs entrées Home :** Protégé. Si l'utilisateur ouvre une *nouvelle* vue Home (ex: depuis l'écran Words en naviguant vers l'avant), un nouvel index est créé (ex: `2`). Aucune clé `furago_home_scroll_2` n'existant, le composant force le scroll à `0` sans utiliser la position de la Home index `0`.

## 6. Critical scenario
**Scénario :** Home à position 1200px → scroll supplémentaire jusqu'à 1500px → clic immédiat sur Article (< 150ms) → Back.
**Valeur restaurée :** `1200`. 
**Explication :** Le scroll jusqu'à 1500 déclenche le `setTimeout` de 150ms. Le clic sur l'article déclenche le démontage de Home. Le `cleanup` efface le timeout de 150ms. Le navigateur va sur l'article. La dernière valeur stockée dans `sessionStorage` reste 1200. Au retour, le système restaure 1200.

## 7. Risks
1. **Perte du delta de scroll récent :** Inconfort utilisateur s'il scrolle et clique très vite (scénario fréquent sur mobile pour attraper un bouton qui passe).
2. **Race condition du délai 50ms :** Retour en haut systématique si le téléphone subit un lag de rendu > 50ms au moment de l'appui sur "Back".

## 8. Recommended minimal hardening
1. Ajouter le `setItem` synchrone dans la fonction de nettoyage (`cleanup`) du `useEffect`.
2. (Optionnel mais recommandé) Remplacer `setTimeout(..., 50)` par un utilitaire de double `requestAnimationFrame` ou utiliser `useLayoutEffect`.

## VERDICT
STATUS: FAIL
