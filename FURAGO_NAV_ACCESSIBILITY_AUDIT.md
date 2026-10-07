# Audit Navigation, Accessibilité et UX Mobile - Furago Web

## Executive Summary
Cet audit met en évidence une application solide avec de bonnes bases fonctionnelles, mais qui souffre de plusieurs problèmes structurels liés à l'absence de routage URL (State-based routing) et à l'implémentation de composants interactifs personnalisés. Les parcours de base fonctionnent, mais l'expérience utilisateur (notamment la rétention de la position de scroll) et l'accessibilité au clavier nécessitent des ajustements.

## Navigation

### Home
- **Entrée :** Point d'entrée par défaut.
- **Sortie :** Vers Article, SRS ou Mots.
- **Comportement :** La Home fait également office de Catalogue. Le scroll peut devenir important.

### Catalogue
- **Problème :** Il n'y a pas de vue Catalogue distincte. Le contexte de scroll est perdu.
- **Détail :** Lorsqu'on quitte un Article via le bouton retour du header, l'utilisateur est ramené à la position de scroll correspondant à sa lecture dans l'article (car le `window.scrollY` n'est pas réinitialisé, mais la hauteur du DOM change). S'il rentre via "Back to Home" sur l'écran de Reward, `window.scrollTo(0,0)` est forcé, effaçant sa progression dans la liste. 

### Article
- **Entrée :** Depuis Home/Catalogue ou "Série".
- **Sortie :** Header Back, Reward Back, ou Next Article.
- **Comportement :** Le scroll est géré par une sauvegarde locale (`articleProgress`), ce qui restaure bien la position de lecture.

### Quiz
- **Entrée :** Fin du scroll dans un article.
- **Sortie :** Reward.
- **Comportement :** Intégré à la vue lecture de manière fluide.

### Reward
- **Entrée :** Complétion du quiz ou bouton "Finished Reading".
- **Sortie :** "Next Article" ou "Back to Home".
- **Comportement :** "Back to Home" remet brutalement au top de la page d'accueil.

### Mots
- **Entrée :** Navigation basse.
- **Sortie :** SRS Review ou Home.
- **Comportement :** Le retour depuis le SRS réinitialise le scroll à 0. L'état de la liste ouverte est conservé.

### SRS
- **Entrée :** Home ou Mots.
- **Sortie :** Retour à l'origine (`vocabReviewReturnTo`).
- **Comportement :** Le retour renvoie bien à la bonne vue, mais force `window.scrollTo(0,0)`.

## Accessibilité

- **BLOCKER :** Le bouton de fermeture de la modale de filtre par catégorie est manquant. L'utilisateur clavier est piégé et ne peut pas fermer la modale.
- **BLOCKER :** Les mots de vocabulaire cliquables dans les articles (`<span onClick>`) n'ont ni `tabIndex`, ni `role="button"`, ni `onKeyDown`. Ils sont inaccessibles au clavier.
- **IMPORTANT :** `TargetVocabularyItem` et les mots de la vue Mots (`<h3 className="tap-word">`) utilisent des divs ou titres avec `onClick` sans accessibilité.
- **IMPORTANT :** Focus management inexistant sur les modales. L'utilisateur peut tabuler en dehors des modales (pas de focus trap) et la touche `Escape` n'est pas gérée.

## Mobile UX

- **WARNING :** L'absence de routage fait que l'utilisation du bouton de retour natif du téléphone (Android) ou du swipe (iOS) va brutalement quitter l'application, causant une immense frustration.
- **WARNING :** Les "zones tactiles" des mots individuels dans l'article peuvent être difficiles à viser avec précision sur mobile sans zoom, et les clics manqués ne donnent aucun feedback.

## Responsive

- **PASS avec WARNING :** L'interface résiste bien aux petits écrans (~375px), mais la `audio-panel` (Lecteur TTS) est fixée à `bottom: 0` sans marge de sécurité, ce qui peut la faire chevaucher la barre d'accueil (Home Indicator) des iPhones.
- **WARNING :** `.bottom-nav` inclut bien `env(safe-area-inset-bottom)` dans son padding, mais possède un `height: 65px` fixe avec `box-sizing: border-box`. Sur certains appareils, cela écrase les icônes.

## États loading/error/empty

- **PASS :** Les états de chargement (Home) et vides (Vocabulaire / Mots) sont clairs et explicites.
- **WARNING :** Si la synthèse vocale (TTS) échoue, elle se coupe silencieusement (`isPlayingRef.current = false`) sans alerter visuellement l'utilisateur.

## URL / Browser Navigation

- **FAIL (Blocker UX) :** Tout repose sur un état React (`activeView`). 
- Il n'y a pas d'URL (Deep Linking impossible).
- Actualiser la page ramène systématiquement à l'accueil.
- Le bouton Précédent du navigateur quitte l'application au lieu de revenir à la vue précédente.

## TTS UX

- **PASS :** Le bouton Play/Pause est accessible et clair.
- **WARNING :** Le surlignage avance bien, mais la page ne "scrolle" pas automatiquement pour suivre la lecture si le texte sort de l'écran. 

## Rétention

- **FAIL :** La boucle de rétention (`Home → Article → Quiz → Reward → Home`) est entravée car le retour à la `Home` détruit le contexte de défilement du Catalogue. L'utilisateur qui voulait lire le 5e article du catalogue doit scroller à nouveau après avoir fini le 4e, ce qui génère de la friction.

## Problèmes prioritaires

| ID | Problème | Zone | Sévérité | Impact utilisateur | Effort estimé |
| -- | -------- | ---- | -------- | ------------------ | ------------- |
| 1 | Bouton Retour Android/Navigateur quitte l'app | Global | P0 | Très fort | Moyen |
| 2 | Perte de position de scroll au retour sur Catalogue | Home / Article | P1 | Fort | Faible |
| 3 | Surlignage TTS (Mots interactifs) inaccessible au clavier | Article | P0 | Fort (A11y) | Faible |
| 4 | Modales sans gestion Escape ni Focus Trap | Modales | P0 | Fort (A11y) | Faible |
| 5 | Lecteur Audio masque l'indicateur d'accueil iOS (Safe Area) | TTS (Mobile) | P1 | Fort | Très faible |
| 6 | `.bottom-nav` avec hauteur fixe et safe-area écrase contenu | Navigation | P1 | Moyen | Très faible |
| 7 | Titres/Divs avec `onClick` (TargetVocab, Mots) sans a11y | Vocabulaire | P1 | Fort (A11y) | Faible |
| 8 | Erreur silencieuse en cas d'échec TTS | Lecture | P2 | Faible | Faible |

## Recommandations

1. **Routage et Contexte :** Implémenter Next.js `nuqs` (URL state) ou un routeur basique pour gérer l'historique et permettre au bouton Retour du navigateur de fonctionner.
2. **Scroll Management :** Mémoriser la position de défilement de la `Home` avant d'ouvrir un article et la restaurer au retour.
3. **Accessibilité :** Remplacer les `<span onClick>` par des `<button>` non stylés ou ajouter `role="button"`, `tabIndex={0}`, et `onKeyDown` pour permettre la sélection au clavier.
4. **Safe Area :** Utiliser `padding-bottom: env(safe-area-inset-bottom);` sur `.audio-panel` et corriger la `.bottom-nav` avec un `min-height` au lieu de `height`.

## Points à ne PAS modifier maintenant

- **Dette Technique :** Les 2 erreurs ESLint `react-hooks/set-state-in-effect` (identifiées dans la console) sont documentées et ne doivent pas être corrigées.
- **Architecture complète :** Ne pas refactoriser l'intégralité du routing vers Next.js App Router immédiatement. Privilégier une approche de patch UX/A11y dans le composant actuel.

## Tests effectués

- Analyse statique approfondie des composants React.
- Typechecking et Linting confirmant l'absence de bugs fatals hors dette existante.
- Simulation des dimensions mobiles et des "Safe Areas" Apple via analyse CSS/Tailwind.

## Verdict

`STATUS: FAIL`

*(Raison : bien que fonctionnelle, l'application souffre d'un défaut UX critique où le bouton précédent quitte l'application et l'accessibilité clavier est bloquante sur des fonctionnalités centrales (Modales, Mots).)*
