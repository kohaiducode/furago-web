# Plan d'Implémentation et d'Amélioration de Furago

## 1. Architecture actuelle
Furago est une application web (PWA potentielle) propulsée par Next.js (App Router utilisé comme conteneur SPA). L'architecture est actuellement fortement monolithique : la majorité de la logique d'état, de filtrage, de lecture, d'interaction et d'affichage est concentrée dans `src/components/FuragoApp.tsx` (près de 4000 lignes). L'application n'utilise pas de base de données backend ; toutes les données pédagogiques sont chargées depuis des fichiers JSON statiques (`articles.json`, `dict.json`) au format brut, et la progression de l'utilisateur est entièrement gérée côté client via `localStorage`.

## 2. État global actuel
L'état est centralisé dans le composant principal via de multiples hooks `useState` et persisté de manière isolée via des helpers (`src/lib/userState.ts`).
Le schéma `UserState` conserve :
- Le niveau courant de l'utilisateur (`level`).
- La progression (`xp`, `furagoLevel`, `currentStreak`, `longestStreak`, dates d'activité).
- Le vocabulaire enregistré manuellement (`savedVocabulary`).
- Le vocabulaire appris passivement (`learnedVocabulary`).
- L'historique des articles complétés et le suivi de l'article en cours de lecture (`lastOpenedArticleId`, `articleProgress`).

La langue de l'interface (`appLang`) est persistée indépendamment de `UserState` pour des raisons architecturales.

## 3. Flux de progression utilisateur
1. **Onboarding / Home :** L'utilisateur atterrit sur la vue d'accueil filtrée par son `globalLevel`. Il est accueilli par une section "Priorités" (Continuer la lecture, Mission du jour, Révision, Prochain épisode).
2. **Découverte :** Il explore le feed (filtré par catégories/niveau).
3. **Apprentissage :** Il ouvre un article. L'article présente les mots cibles (`targetVocabulary`), puis le texte interactif (`paragraphs`/`segments`).
4. **Validation :** Après avoir lu et écouté (TTS), l'utilisateur répond à un quiz pour tester sa compréhension.
5. **Complétion :** Il valide l'article, reçoit de l'XP, prolonge son streak, et retourne à l'accueil où le feed et les priorités sont mis à jour.

## 4. Flux XP, Streak et Complétion
La complétion est le déclencheur principal de la progression. Lors de la complétion d'un article :
- **Streak :** Si l'utilisateur complète un article pour la première fois de la journée (`lastStreakDate !== aujourd'hui`), le streak augmente (+1).
- **XP Lecture :** Gain d'XP fixe pour la lecture.
- **XP Quiz :** Gain d'XP additionnel calculé en fonction des bonnes réponses, avec un bonus potentiel si le score est parfait.
- **Daily Mission :** Si l'article complété correspond à la `dailyArticle`, l'utilisateur débloque l'état "Mission Complétée" et gagne un bonus d'XP supplémentaire.
- Les données sont immédiatement sérialisées via `updateUserState`.

## 5. Flux dictionnaire
L'expérience de lecture repose sur un texte interactif.
1. Un mot est cliqué (`handleWordClick`).
2. S'il y a une traduction contextuelle dans `segments`, elle s'affiche directement (Tooltip).
3. Sinon, une requête est envoyée à `src/lib/dictionary.ts` qui fouille `dict.json`.
4. Le dictionnaire s'ouvre dans une modale modulaire en bas de l'écran, affichant la définition, le genre, la nature, et permettant de sauvegarder le mot (`savedVocabulary`) dans une liste personnalisée.

## 6. Flux TTS (Text-to-Speech)
La synthèse vocale utilise l'API native `window.speechSynthesis`.
- **Mécanisme :** Le texte de l'article est découpé en phrases. Les phrases sont placées dans une file d'attente (`ttsQueue`).
- **Synchronisation :** Au fur et à mesure que `speechSynthesis` avance, un événement met à jour `queueIndex` pour surligner visuellement la phrase en cours de lecture.
- **Contrôles :** L'utilisateur peut ajuster la vitesse, mettre en pause, reprendre ou changer la voix francophone sélectionnée.

## 7. Flux Quiz
Intégré en bas de l'article, le quiz parse l'objet `quiz` de la base de données.
- Gère la rétrocompatibilité (Legacy quiz avec `options: Record<string,string>`).
- L'utilisateur sélectionne ses réponses de manière séquentielle.
- Une fois terminé, le score est calculé et verrouillé pour cet article (les tentatives suivantes ne rapportent plus d'XP).

## 8. Flux Vocabulaire (Wordbook)
Il est divisé en deux sections distinctes pour éviter la surcharge mentale :
- **Saved (Listes personnelles) :** Les mots que l'utilisateur a explicitement ajoutés via le dictionnaire. Ils sont éligibles à la "Today's Review" (mini-jeu de révision Flashcard) qui rapporte de l'XP.
- **Learned (Appris automatiquement) :** Les mots-clés (`targetVocabulary`) extraits automatiquement des articles complétés. Ils sont fusionnés silencieusement (`mergeLearnedVocabulary`) et affichent leur origine (titres des articles).

## 9. Flux Newsletter
Généré via un formulaire intégré (`lead-bar`), il capture l'email, le nom, le niveau et les catégories préférées pour alimenter une base de données Google Sheets via Google Apps Script (GAS). L'état est local pour la session afin d'afficher "Vérification..." ou "Succès".

## 10. Bugs potentiels identifiés
- **TTS Mobile :** Sur iOS/Safari, l'API Web Speech peut s'interrompre si l'écran se verrouille ou couper les phrases longues.
- **Performances de rendu :** `FuragoApp.tsx` déclenche un re-render complet à chaque touche frappée, changement d'onglet ou mise à jour de l'API TTS (très coûteux avec des longs articles).
- **Matching du dictionnaire :** La recherche exacte ou par préfixe sur le JSON peut rater des conjugaisons complexes non présentes dans `dict.json`.
- **Stockage LocalStorage :** Risque de dépassement du quota de 5MB si l'utilisateur accumule des milliers de mots enregistrés ou si `completedArticles` grossit de manière déraisonnable au fil des années.

## 11. Dette technique
- Composant `FuragoApp.tsx` massif (~3900 lignes).
- Styles massivement appliqués de manière "inline" (ex: `style={{ padding: '20px', borderRadius: '16px' }}`) ce qui empêche le caching du CSS, ralentit le rendu JS et empêche un vrai mode Sombre/Clair fluide.
- Mélange de logique d'affaires (calcul d'XP), de logique système (TTS) et de présentation (UI) dans le même fichier.
- Absence de fonctionnalité de recherche d'articles (système introuvable, requérant une future implémentation).

## 12. Risques avant refactor
- **Briser le calcul d'XP/Streak :** Toute modification des hooks de progression risque d'altérer la gamification, frustrant ainsi les utilisateurs.
- **Perte de données :** Modifier la structure de `userState.ts` sans gestion stricte de la migration effacerait les listes de vocabulaire des utilisateurs.
- **Rupture de la synchronisation TTS :** Extraire la logique TTS du composant de lecture (où elle interagit directement avec l'index des paragraphes) pourrait créer des décalages de surlignage.

## 13. Dépendances entre les modifications
- **Hooks d'états :** `FuragoApp` passe l'état de l'utilisateur à toutes ses sous-vues. Le découpage de l'UI nécessitera de passer massivement des `props` ou de mettre en place un Contexte React (`UserContext`).
- **Styles :** L'extraction des styles inline vers `globals.css` doit précéder la création de composants réutilisables (ex: `Card`, `Button`, `Badge`) pour garantir une consistance visuelle.

## 14. Ordre recommandé d'implémentation
1. **Implémentation de la fonction de recherche :** Corriger le manque identifié lors de l'audit (ajouter un Input et filtrer `filteredArticles`).
2. **Standardisation du CSS :** Migrer les styles inline répétitifs vers des classes dans `globals.css` (Boutons, Cartes, Badges).
3. **Extraction de composants simples :** Déplacer la `Newsletter`, le `Wordbook`, et les `ArticleCard` dans des fichiers séparés en passant les états nécessaires via les props.
4. **Création de Hooks personnalisés :** Découper la logique métier (ex: `useTTS.ts`, `useQuiz.ts`, `useDailyMission.ts`).
5. **Extraction des Vues complexes :** Sortir `ReadingView` et `HomeView` de l'application principale.
6. **Mise en place d'un Context API (Optionnel) :** Si le `prop-drilling` devient insupportable.

---

### Les 10 fichiers les plus importants à modifier et pourquoi

1. **`src/components/FuragoApp.tsx`**
   *Pourquoi :* C'est le cœur du problème (dette technique). Le fichier doit être drastiquement réduit en déléguant son rendu à des sous-composants.
2. **`src/app/globals.css`**
   *Pourquoi :* Il doit absorber tous les styles inline de `FuragoApp.tsx` pour créer un vrai design system réutilisable et optimiser les performances.
3. **`src/components/ArticleCard.tsx` (À créer)**
   *Pourquoi :* Ce composant est dupliqué visuellement dans le feed, les priorités et les séries. Son extraction simplifiera considérablement la boucle de rendu de l'accueil.
4. **`src/components/ReadingView.tsx` (À créer)**
   *Pourquoi :* Gère la fusion délicate du TTS, de la sélection de mots et du quiz. L'isoler protège le reste de l'app de ses re-renders intensifs.
5. **`src/lib/userState.ts`**
   *Pourquoi :* Prépare le terrain pour une future synchronisation Cloud. Doit devenir plus robuste contre la corruption des données locales.
6. **`src/hooks/useTTS.ts` (À créer)**
   *Pourquoi :* La logique de l'API Web Speech pollue actuellement l'UI. L'encapsuler dans un hook permettra un meilleur contrôle du cycle de vie et une gestion des erreurs cross-browser.
7. **`src/lib/dictionary.ts`**
   *Pourquoi :* Moteur de recherche rudimentaire. Nécessite une optimisation pour rechercher efficacement les lemmes et mieux tolérer les variations orthographiques.
8. **`src/data/articles.json`**
   *Pourquoi :* Plus l'application grandira, plus ce fichier pèsera lourd. Une future architecture devra le découper (pagination, ou chargement différé par niveau).
9. **`src/components/FilterBar.tsx` (À créer)**
   *Pourquoi :* Permettra d'ajouter enfin la barre de recherche textuelle sans alourdir le code de la vue Home.
10. **`package.json`**
    *Pourquoi :* Sera modifié pour inclure des outils essentiels à l'évolution (par exemple `lucide-react` pour remplacer les emojis par des icônes SVG, ou des outils de test pour l'XP).
