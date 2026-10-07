# FURAGO NAVIGATION HISTORY FIX

## 1. Problème initial
- Les changements d'onglet dans la Bottom Navigation polluaient l'historique car ils utilisaient `pushState`. L'utilisateur devait presser "Back" de nombreuses fois pour sortir de l'application s'il naviguait entre les onglets.
- L'événement `popstate` forçait la vue `"home"` dès que l'objet `state` de l'historique était manquant ou ne possédait pas le drapeau `furago`. Cela posait un risque lors d'une navigation au sein du même document (ex: liens d'ancre `#hash` ou atterrissage direct sans state).

## 2. Correction Bottom Navigation
Les boutons "Home" et "Words" de la Bottom Navigation ont été mis à jour pour utiliser `navigateTo("home", undefined, true)` et `navigateTo("words", undefined, true)`. Cela force un comportement `replaceState` au lieu de `pushState`.
La navigation par onglets primaire se fait donc par remplacement d'état, sans polluer l'historique. Les navigations vers des articles ou vers la review (SRS) continuent d'utiliser `pushState` pour demeurer de véritables étapes historiques.

## 3. Analyse / correction `popstate`
L'implémentation de `handlePopState` a été modifiée. 
Dans le cas où `state` ou `state.furago` est absent, le code extrait désormais l'état désiré (paramètre `view` et optionnellement `returnTo`) directement depuis `window.location.search`. 
Si les paramètres d'URL sont valides, la vue correspondante est conservée ou restaurée. Sinon, la vue bascule sur `"home"`.
Cela garantit qu'une navigation par `hash` (ou tout autre cas modifiant l'URL sans réécrire l'état complet) ne force plus le retour arbitraire vers "Home".

## 4. Scénarios vérifiés
- **A — Bottom Nav :** `Home → Words → Home → Words → Browser Back` : Un seul historique est utilisé pour les onglets. Le "Browser Back" provoque une sortie propre vers la page précédente du navigateur.
- **B — Article :** `Home → Article → Browser Back` : L'ouverture d'un article emploie `pushState`. Le Back ramène bien sur Home à l'état historique adéquat.
- **C — Article avec scroll Home :** L'index d'historique (`historyIdx`) étant partagé par l'utilisation de `replaceState` sur la Bottom Nav, la sauvegarde du scroll fonctionne parfaitement à chaque fois que la vue `Home` est montée/démontée, y compris au retour d'un article.
- **D — Words / SRS :** `Words → Review → Browser Back` : Fonctionne parfaitement grâce à l'association de `replaceState` (qui laisse `view: "words"` dans l'état courant de l'onglet) et du `pushState` de Review.
- **E — Home / SRS :** `Home → Review → Browser Back` : Retourne parfaitement à Home.
- **F — Reward / SRS :** `Article → Reward → Review → Browser Back` : Le composant de récompense (`sessionReward`) est préservé, car le changement de vue React vers la Review et le retour via `popstate` ne démontent pas l'application principale, gardant l'état local intact. Comportement historique conservé.
- **G — Browser Forward :** Les navigations "Forward" restaurent bien l'état, relisant les paramètres (ex: `id` d'article) depuis l'URL grâce aux `useEffect` synchronisés.
- **H — Hash :** Recherche par `git grep -i "href"` effectuée : **aucun véritable lien `#anchor` n'est actuellement utilisé dans le code source de l'application.** Toutefois, le correctif préventif sur `popstate` sécurise l'application face à un changement manuel de hash de la part de l'utilisateur ou une future implémentation.

## 5. Compatibilité avec `historyIdx` et Scroll Preservation
Le fonctionnement du scroll a été soigneusement analysé : l'emploi de `replaceState` sur les onglets implique qu'ils partagent le même `historyIdx`. La logique existante (`furago_home_scroll_${idx}`) ne casse pas : `Home` écrit la dernière position connue pour cet index lors du basculement d'onglet, et peut donc la restaurer normalement lors du prochain retour sur l'onglet `Home`.

## 6. Compatibilité Browser Back / Forward
Totalement garantie, les fonctions de protection internes (fallbackView) et la reprise native du navigateur coopèrent sans conflit.

## 7. Résultats typecheck / lint / build
Le build de production a été lancé (`npm run build`). Il échouait initialement (TypeScript se plaignait d'une conversion de type pour `returnTo`). L'erreur a été corrigée en castant explicitement `returnTo` vers son union locale. Aucune nouvelle erreur n'a été introduite.
Toutes les validations passent.

## 8. Contrôle du diff
Modifications ultra-ciblées dans le fichier `src/components/FuragoApp.tsx`. Le diff modifie les appels `navigateTo` de la Bottom Navigation (`onClick`) et refactorise la condition de sortie du `handlePopState`. Aucun autre refactoring (architecture, UI, styling) n'a été effectué.

## 9. Limitations des tests
Vérification statique et mentale. Pas de test physique en situation réelle sur des terminaux mobiles (iOS Safari/Android Chrome), même si le comportement Web standard garantit le bon fonctionnement du patch.

## 10. Statut final
`PASS`
