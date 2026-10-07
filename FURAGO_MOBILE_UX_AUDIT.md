# FURAGO MOBILE UX AUDIT

## Executive Summary
Cet audit s'est concentré sur l'expérience mobile de Furago afin d'identifier les frictions majeures, en particulier celles impactant la rétention et l'utilisabilité sur smartphone. L'analyse révèle une application globalement bien structurée, mais souffrant de quelques défauts critiques : **la perte systématique du scroll lors des navigations (P1)**, **l'absence de bouton direct vers le SRS après avoir appris de nouveaux mots (P1)**, et des problèmes ergonomiques liés aux **safe-areas (P1)** et aux **touch targets (P1/P2)**. Les recommandations visent des "quick wins" techniques et UX.

## Device / viewport analysis
- **VÉRIFIÉ PAR INSPECTION** : L'interface est fluide de 320px à 414px grâce à une utilisation systématique de largeurs relatives (`100%`) et de Flexbox/Grid.
- **INFÉRÉ / À VALIDER** : Les appareils avec *home indicator* (notch) souffrent de problèmes de chevauchement sur la navigation et le lecteur audio car la variable `env(safe-area-inset-bottom)` n'est pas implémentée.
- **INFÉRÉ / À VALIDER** : Sur petit viewport (320px), la densité de certains blocs (comme l'en-tête de la page d'accueil ou le lecteur audio) peut paraître chargée, mais les textes se redimensionnent ou utilisent des ellipses correctement.

## Home
- **OBSERVÉ RÉELLEMENT / VÉRIFIÉ PAR INSPECTION** : La progression, le niveau, l'XP, le streak et la mission du jour sont clairement délimités.
- **Problème UX** : La barre de Lead Generation (`.lead-bar`) est très visible en haut et prend de la place avant même le contenu principal.
- **Friction** : L'action principale n'est pas toujours unique. Il peut y avoir un article "Continuer", des "Mots à réviser" et une "Mission du jour" affichés simultanément, ce qui dilue le CTA principal.
- **Recommandations** : Unifier le "Next Best Action" (ex: un seul gros CTA dynamique "Continuer l'article" OU "Faire ma mission" OU "Réviser mes mots").

## Article
- **VÉRIFIÉ PAR INSPECTION** : La largeur de lecture (`--reading-max-width`) et la police sont adaptées. L'espacement des lignes (`1.85`) est excellent pour la lisibilité sur mobile.
- **Friction** : La zone de padding inférieure (`padding-bottom: 165px;`) permet d'éviter l'audio panel, mais cela coupe parfois l'élan de lecture ou laisse un grand espace blanc si l'audio n'est pas actif.
- **Touch Targets** : Les mots cliquables (`.tap-word`) ont un padding vertical faible (`2px 0`).
- **Continuité** : Le passage direct au Quiz après le dernier paragraphe est naturel et fluide.

## Quiz
- **VÉRIFIÉ PAR INSPECTION** : Les boutons de réponses `.quiz-option` ont une taille suffisante (`~46px` de hauteur via `padding: 13px 16px`).
- **Feedback** : Instantané et visuel (vert/rouge) avec une bonne utilisation de CSS (`background: var(--green-light)`).
- **Friction** : La navigation peut sembler bloquée si l'utilisateur ne comprend pas qu'il doit scroller après le quiz pour voir l'écran de fin.

## Reward
- **VÉRIFIÉ PAR INSPECTION** : Affiche bien l'XP, le Streak, les mots appris et le statut SRS.
- **Friction (Rétention - P1)** : L'écran indique "+X New Words" et "X items Due for Review", mais les seuls CTA sont "Next Article" ou "Back to Home". Il y a une perte totale de momentum pour l'apprentissage du vocabulaire. L'utilisateur devrait pouvoir lancer son SRS immédiatement d'ici.
- **Recommandation** : Ajouter un CTA primaire "Réviser mes nouveaux mots" si le SRS est dû, ou remplacer un des CTA secondaires.

## Words
- **VÉRIFIÉ PAR INSPECTION** : La liste est claire. Les cartes système ("Mots appris") et listes personnalisées sont bien séparées.
- **Friction** : La navigation vers un mot spécifique pour l'écouter ou le supprimer nécessite une grande précision tactile.

## SRS
- **VÉRIFIÉ PAR INSPECTION** : Le rythme de révision est bon, le mot est affiché en très grand (`2.5rem`, `fontWeight: 800`).
- **Friction** : Une fois la session SRS terminée, l'utilisateur doit cliquer sur "Back", ce qui le renvoie au top de la page précédente (perte de scroll). 

## Bottom Navigation
- **Problème identifié (VÉRIFIÉ PAR INSPECTION)** : `.bottom-nav` utilise `height: 65px; bottom: 0; position: fixed;`. Sur iOS, le home indicator (environ 34px) vient se superposer aux boutons (icônes et labels), rendant le clic difficile ou entraînant un swipe d'application non désiré.
- **Mesure** : L'espace non géré représente les ~34px du `safe-area-inset-bottom`.
- *(NE PAS CORRIGER DANS CETTE PHASE, documenté tel que demandé)*.

## Audio Panel
- **Problème identifié (VÉRIFIÉ PAR INSPECTION)** : `.audio-panel` est fixé en bas (`bottom: 0`) avec un padding fixe (`padding: 14px 20px 22px`).
- **Mesure** : Tout comme la Bottom Navigation, le lecteur ne prend pas en compte le `safe-area`. La zone de contrôle audio (barre de progression ou boutons d'options) chevauche le home indicator.
- *(NE PAS CORRIGER DANS CETTE PHASE, documenté tel que demandé)*.

## Scroll
- **BUG MAJEUR (VÉRIFIÉ PAR INSPECTION)** : Bien qu'un mécanisme de restauration de scroll existe (via `sessionStorage` et `handleScroll`), un bug logique l'invalide. Lors d'un clic sur "Back to Home" ou d'une navigation vers un article, la fonction `navigateTo` est appelée *suivie immédiatement* de `window.scrollTo(0,0)`.
- **Mécanique de la casse** : Le `window.scrollTo(0,0)` déclenche le `handleScroll` sur la vue *actuelle* avant qu'elle ne soit démontée, écrasant la position sauvegardée par `0`. Résultat : le scroll est systématiquement perdu pour la vue Home.
- **Impact Rétention** : Très pénalisant (Home -> Article -> Back Home = retour tout en haut), oblige l'utilisateur à rescroller manuellement la liste des articles à chaque fois.

## Virtual Keyboard
- **INFÉRÉ / À VALIDER** : La modale "Créer une liste" (New List Dialog) utilise un `<dialog>` avec `margin: 0 auto`. Sur iOS Safari, lorsque le clavier virtuel s'ouvre, il a tendance à masquer ce type de modale centrée si elle ne remonte pas dynamiquement.
- **Recommandation** : Aligner la modale vers le haut ou utiliser un bottom sheet ajustable au clavier.

## Touch Targets
- **VÉRIFIÉ PAR INSPECTION** :
  - **Bouton Back (Header)** : Hauteur estimée à 32px (`padding: 6px` sur icône 20px). Trop petit (Apple recommande 44px). Risque de rater le clic. Priorité : P2.
  - **Boutons Audio Panel** : Taille estimée à 32px. Risque élevé de miss-click en marchant. Priorité : P1.
  - **Boutons Dict-Popup (Save/Audio)** : Fixés à `width: 28px; height: 28px;`. Très difficile à viser avec le pouce. Priorité : P1.

## Retention Frictions
1. **Perte de contexte (Scroll)** : Revenir à l'accueil efface le progrès de navigation dans la liste des articles.
2. **Impasse post-Article** : Le Reward Screen célèbre l'apprentissage de nouveaux mots, mais n'offre aucun bouton direct pour les pratiquer (SRS).
3. **CTA concurrents sur Home** : Trop de sollicitations de même poids visuel (Mission vs SRS vs Continuer).

## Retention Opportunities
1. **Next Action Intelligente** : Transformer l'écran Reward pour qu'il propose dynamiquement "Lancer ma révision" si des mots ont été ajoutés ou sont dus.
2. **Continuité de session SRS** : À la fin du SRS, proposer d'enchaîner sur un nouvel article court plutôt que de simplement renvoyer à l'accueil.
3. **Scroll Preservation** : Supprimer le `window.scrollTo(0,0)` manuel avant le démontage du composant pour retrouver la position exacte dans la liste Home.

## P0/P1/P2/P3 Prioritization

| Localisation | Problème | Impact | Fréq. | Gravité | Effort | Risque Rég. | Recommandation | Prio |
|--------------|----------|--------|-------|---------|--------|-------------|----------------|------|
| App/Router | `window.scrollTo(0,0)` écrase le scroll | Perte de contexte | 100% | Haute | Faible | Faible | Retirer le scroll manuel *avant* le routing, ou attendre le mount de la nouvelle vue. | **P1** |
| Reward Screen | Pas de CTA SRS post-lecture | Casse la boucle de rétention | 100% | Haute | Faible | Faible | Ajouter un bouton "Réviser le vocabulaire" sur l'écran Reward. | **P1** |
| Audio Panel | Touch targets de 28px/32px | Miss-click audio | Haute | Moy. | Faible | Faible | Augmenter le padding pour atteindre 44x44px min. | **P1** |
| Bottom Nav | Safe-area non géré | Touches impossibles sur notch | 100% (iOS) | Haute | Faible | Faible | Ajouter `padding-bottom: env(safe-area-inset-bottom)` | **P1** |
| Audio Panel | Safe-area non géré | Touches impossibles sur notch | 100% (iOS) | Haute | Faible | Faible | Ajouter `padding-bottom: calc(22px + env(safe-area-inset-bottom))` | **P1** |
| Words/List | Modale couverte par clavier virtuel | Impossible de créer une liste | Moy. | Haute | Moy. | Faible | Ajuster le CSS de la dialog. | **P1** |
| Header | Bouton "Back" trop petit (32px) | Miss-click navigation | Haute | Faible | Faible | Faible | Augmenter la zone cliquable du chevron. | **P2** |
| Home | Multiples sections = CTA dilués | Surcharge cognitive | Haute | Moy. | Élevé | Moyen | Regrouper "Mission", "Continuer" et "Réviser" dans un "Next Best Action" unique. | **P2** |
| Article | Mots `.tap-word` un peu petits verticalement | Miss-click mot | Moy. | Faible | Moy. | Moyen | Ajuster le line-height ou le padding interactif sans casser le texte. | **P3** |

## Recommended implementation order
1. Corriger le bug du scroll perdu (Quick win, impact énorme sur la rétention).
2. Ajouter le CTA "SRS" sur le Reward Screen.
3. Fixer les Touch Targets de l'Audio Panel et du Dict Popup.
4. Ajuster la gestion du clavier virtuel pour la modale New List.
5. (À planifier) Ajouter les variables de safe-area (Bottom Nav / Audio).

## Explicitly deferred items
- Refactoring `FuragoApp.tsx` (Hors périmètre).
- Modifications majeures de la navigation ou du routing (History API non touchée).
- Changements visuels ou de design majeurs (Gamification, UserState).
- Correction immédiate de l'accessibilité (déjà audité) et du problème de safe-area (mesuré mais non implémenté).

## Final verdict
STATUS: PASS
