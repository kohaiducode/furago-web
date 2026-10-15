# Audit Rétention P2 : Home et « Next Best Action »

## 1. Executive Summary
L'audit de la vue Home (`FuragoApp.tsx` et `home.ts`) révèle que la hiérarchie actuelle des appels à l'action (CTA) donne systématiquement la priorité absolue à la reprise d'un article en cours (« Continuer »), au détriment des mécaniques temporelles (Mission quotidienne, Révisions SRS). Bien qu'une logique de mise en avant visuelle (`primaryHomeAction`) existe, l'empilement vertical de toutes les sections sur mobile crée un risque de friction et d'oubli des actions de rétention clés (streak et mémorisation).

## 2. Home actuelle
La Home (définie dans `FuragoApp.tsx`, active lorsque `activeView === "home"`) présente les éléments suivants, empilés de haut en bas :
1. **Progression** : Niveau, XP, Streak, jauge d'XP jusqu'au niveau suivant.
2. **Continuer** : Article entamé (>5% lu) ou prochain épisode d'une série.
3. **À Réviser** : Compteur de mots SRS dus aujourd'hui.
4. **Mission du jour** : Article du jour ciblé pour gagner un bonus XP.
5. **Recommandations** : 3 articles suggérés de catégories variées.
6. **Catalogue complet**.

## 3. CTA recensées
Voici les actions principales (CTA) affichées sur la Home :

* **Continuer / Reprendre**
  * **Texte** : "Continue reading" / "続きを読む" (ou "Next episode").
  * **Destination** : Ouverture de l'article via `openArticle(continueTarget)`.
  * **Condition** : Un `continueTarget` est identifié (via `selectContinueArticle` ou `currentSeriesNextEp`).
  * **Importance visuelle** : Primaire (`homeCta(true)`) si affiché, secondaire sinon.
  * **Relation état** : Lié à `articleProgress` et `completedArticles`.

* **Mission du Jour**
  * **Texte** : "Read" / "読む".
  * **Destination** : `openArticle(dailyArticle)`.
  * **Condition** : Mission non complétée (`!isMissionCompletedToday`). Si la mission est le même article que "Continuer" (`missionIsContinue`), la carte est fusionnée avec un texte ("🎯 This is today's mission").
  * **Importance visuelle** : Primaire seulement si "Continuer" est absent.

* **Révision SRS**
  * **Texte** : "Review" / "復習する".
  * **Destination** : `startVocabReview("learned", "home")`.
  * **Condition** : Mots en attente (`dueReviewCount > 0`).
  * **Importance visuelle** : Primaire uniquement si "Continuer" ET "Mission" sont absents.
  * **Relation état** : Dépend directement des timestamps du SRS dans `learnedVocabulary`.

* **Recommandations**
  * **Texte** : Titre des articles (liste simple).
  * **Destination** : `openArticle(a)`.
  * **Importance visuelle** : Liste d'éléments classiques (Tertiaire).

## 4. Scénarios utilisateurs

### A. Nouveau / sans article commencé
* **État** : Aucune progression, aucune révision urgente, mission disponible.
* **Affichage actuel** : La Mission du jour est le CTA primaire.
* **Idéal** : Parfait, guide directement vers la première action.

### B. Article en cours
* **État** : Article partiellement lu, mission disponible, SRS disponible.
* **Affichage actuel** : "Continuer" est le CTA primaire. "Mission" et "SRS" sont secondaires et potentiellement hors écran sur mobile.
* **Conflit** : L'utilisateur risque d'ignorer ses révisions SRS dues ou sa mission quotidienne.

### C. Révision urgente
* **État** : dueToday > 0, article en cours, mission disponible.
* **Affichage actuel** : "Continuer" prend le pas sur "Review". Le bouton "Review" est rendu secondaire.
* **Conflit** : L'algorithme SRS repose sur un timing précis. Le reléguer en 3ème position de la priorité visuelle nuit à la mémorisation et la rétention long terme.

### D. Mission proche de l'expiration
* **État** : Mission du jour non terminée, révision disponible, article en cours.
* **Affichage actuel** : "Continuer" reste prioritaire. 
* **Conflit** : Le streak (souvent le principal moteur de rétention) risque d'être brisé si l'utilisateur lit juste son article en cours et quitte l'application, sans s'apercevoir que la mission était un *autre* article.

### E. Article terminé + vocabulaire à revoir
* **État** : Article terminé, new vocabulary > 0, SRS due.
* **Affichage actuel** : Si la mission n'est pas finie, elle est primaire. Si elle l'est, "Review" devient primaire.
* **Conflit** : Cohérent, mais le SRS est toujours relégué derrière la lecture d'un nouvel article (mission).

### F. Utilisateur sans aucune action urgente
* **État** : Pas de mission urgente, pas de SRS dû, pas d'article en cours.
* **Affichage actuel** : Recommandations (aucun bouton "primaire").
* **Idéal** : Cohérent, encourage l'exploration du catalogue.

## 5. Conflits de priorité
Le conflit majeur se situe dans l'algorithme "en dur" de `primaryHomeAction` (lignes 1714-1720 de `FuragoApp.tsx`) :
```typescript
const primaryHomeAction = continueTarget ? "continue" 
  : dailyArticle && !isMissionCompletedToday ? "mission" 
  : dueReviewCount > 0 ? "review" 
  : "none";
```
Cette hiérarchie stricte (`Continue > Mission > Review`) favorise systématiquement la lecture (qui n'expire pas) au détriment des boucles de rétention (Mission qui expire à minuit, SRS qui expire maintenant). Le principal conflit est que l'app demande à l'utilisateur de jongler visuellement entre 3 zones d'action concurrentes.

## 6. Analyse de `home.ts`
* `home.ts` centralise déjà des fonctions pures et sans effet de bord (`selectContinueArticle`, `getStreakStatus`, `getNextReviewDayOffset`).
* Actuellement, l'information nécessaire pour définir une Next Best Action existe via le `UserState`.
* Cependant, aucune fonction ne détermine la "Meilleure Action Globale" : la logique est dispersée/hardcodée directement dans la déclaration des variables locales du composant React `FuragoApp.tsx`.
* **Conclusion** : Une nouvelle fonction pure `getNextBestAction(userState, now, ...)` pourrait remplacer ce code dans `FuragoApp.tsx`.

## 7. Analyse Mobile
Sur petit écran :
* **Nombre de CTA sans scroll** : 1 à 2 (Progression + Continuer). Le SRS et la Mission sont très souvent cachés sous la ligne de flottaison.
* **Concurrence visuelle** : Le haut de l'écran est très encombré par le bloc "Progression".
* **Effort nécessaire** : Si le SRS ou la Mission sont la "véritable" priorité d'un point de vue rétention, l'effort cognitif et d'interaction (scroller, choisir entre plusieurs cartes) est trop élevé.
* L'utilisateur ne comprend pas toujours **immédiatement quoi faire**, car la structure UI est une "dashboard" de tout l'état, plutôt qu'une directive unique.

## 8. Stratégie Next Best Action recommandée
Pour améliorer la rétention, la logique doit prioriser les actions basées sur le temps (urgentes) avant les actions de contexte.

**Priorité logique proposée** :
1. **Révision SRS urgente** : C'est l'action la plus sensible au temps. Si des mots sont dus, la mémorisation doit primer.
2. **Mission du jour** : Préserver le streak est crucial pour la rétention quotidienne.
3. **Reprendre un article (Continuer)** : L'article en cours ne disparaîtra pas. Si l'utilisateur veut vraiment le lire, il le fera de lui-même.
4. **Recommandations**.

**UI Next Best Action** :
Au lieu d'afficher 3 cartes empilées distinctes (Continue, Review, Mission), la Home devrait afficher **une seule carte dynamique en haut "Next Best Action"** qui prend la forme de l'action la plus urgente, et bascule les autres dans des listes ou cartes secondaires discrètes.

## 9. Risques
* **Pousser trop fortement le SRS** : Si le SRS est toujours en haut et bloque l'accès à la lecture (frustration de l'utilisateur), l'effet sur la rétention peut s'inverser (churn). 
* **Conflit avec `dailyMissionTarget` / Progression** : Inverser aveuglément les priorités peut perturber l'expérience si la "Mission" ne correspond plus aux envies de lecture de l'utilisateur qui avait déjà un article en cours.
* **Supprimer trop de choix** : Trop simplifier la Home en enlevant la carte "Continuer" ralentirait l'utilisateur qui cherche précisément à finir son histoire.
* **Conflit "Continue" vs "Mission"** : La fusion actuelle via `missionIsContinue` fonctionne très bien et doit absolument être maintenue pour éviter la confusion entre "reprendre" et "commencer".

## 10. Données/Analytics nécessaires pour validation future
Pour confirmer le besoin de changement sans se baser sur des suppositions :
* **Taux d'abandon SRS** : Pourcentage d'utilisateurs qui ont un `dueReviewCount > 0` au lancement, mais qui quittent l'app sans l'avoir réduit.
* **Missed Missions** : Proportion d'utilisateurs qui cliquent sur "Continuer" (un autre article) mais terminent la session sans faire la Mission du Jour.
* **Clics sur Home** : Répartition des premiers clics (Continue vs Mission vs SRS) sur mobile.

## 11. Priorité d'implémentation
* **Classe** : P2 (Expérimentation).
* La structure actuelle est stable et ne comporte pas de bugs bloquants. Toutefois, l'empilement UI mobile freine la boucle de rétention quotidienne. L'implémentation d'une Next Best Action devrait se faire via un A/B test UX dédié pour valider l'impact réel sur le Streak et la complétion SRS.

## 12. Conclusion
La Home de Furago est actuellement architecturée comme un tableau de bord (Dashboard) plutôt que comme un guide (Next Best Action). L'algorithme `primaryHomeAction` codé en dur favorise la lecture "Continue" au détriment du Streak et de la Mémorisation. Déplacer cette logique dans `home.ts` et revoir l'UI mobile pour ne présenter qu'un seul CTA de rétention à la fois réduirait la fatigue cognitive et augmenterait les chances d'engagement quotidien.
