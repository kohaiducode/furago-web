# Audit UX Mobile : Clavier Virtuel & Safe Area (Furago)

## 1. Executive Summary
L'audit du projet Furago ciblant spécifiquement le comportement sur mobile (clavier virtuel et zones de sécurité iOS/Android) a révélé plusieurs problèmes de sévérité P1. L'application est solide, mais l'utilisation de certaines unités CSS statiques (`vh`, `height` fixe couplé à `box-sizing: border-box`) cause des conflits majeurs. 
Aucun refactor complexe n'est requis ; la grande majorité des problèmes peuvent être résolus localement par de simples ajustements CSS.

## 2. Clavier virtuel

### A. Modale de Création de Liste
* **Composant / Fichier** : `src/components/FuragoApp.tsx` (ligne ~3967)
* **Élément** : `dialog.new-list-dialog` et `<input type="text">` (ligne ~3995)
* **Comportement actuel** : La modale utilise un élément natif `<dialog>` centré via un `margin: "0 auto"` en inline-style. 
* **Problème (P1)** : Sur iOS Safari, le clavier virtuel se superpose sans toujours forcer le recadrage de la modale. L'input et les boutons de validation peuvent se retrouver partiellement ou totalement masqués, bloquant l'action de l'utilisateur.
* **Justification** : Gêne critique empêchant la création d'une liste de mots sur mobile.
* **Solution minimale** :
  - S'assurer que le container principal de l'input permet le défilement s'il est compressé, ou utiliser les unités `dvh` pour dimensionner correctement la modale selon le *visual viewport* disponible.

### B. Modale Newsletter (Lead Generation)
* **Composant / Fichier** : `src/components/FuragoApp.tsx` (ligne ~4049)
* **Élément** : Modale en 3 étapes avec les champs prénom et email, utilisant la classe CSS `.modal-sheet`.
* **Comportement actuel** : La classe `.modal-sheet` force `max-height: 75vh` et `display: flex; flex-direction: column`.
* **Problème (P1)** :
  1. **Absence d'overflow** : `.modal-sheet` n'a **pas** de `overflow-y: auto`. Lorsque le clavier virtuel occupe ~50% de l'écran, le contenu (qui s'attend à avoir 75% de l'écran) dépasse mais **ne peut pas être scrollé**.
  2. **Unité vh** : `75vh` se base sur l'écran physique sous iOS Safari. Lorsque le clavier s'ouvre, le bouton d'inscription (submit) ou les messages d'erreur sont poussés tout en bas, devenant inaccessibles et invisibles.
* **Justification** : Gêne critique qui empêche la conversion / l'abonnement à la newsletter depuis un smartphone.
* **Solution minimale** :
  - Ajouter `overflow-y: auto` à `.modal-sheet`.
  - Remplacer `max-height: 75vh` par `max-height: 85dvh`.

## 3. Safe Area

### A. Bottom Navigation (`.bottom-nav`)
* **Composant / Fichier** : `src/app/globals.css` (ligne ~1021)
* **Comportement actuel** : La classe a `height: 65px;` et `padding-bottom: env(safe-area-inset-bottom);`.
* **Problème (P1)** : Le projet utilise `box-sizing: border-box`. Ajouter un `padding-bottom` (ex: 34px sur iPhone) à une hauteur fixe (65px) va écraser la zone de contenu interne (qui passe à ~31px). Les icônes seront déformées ou coupées, rendant la navigation très difficile.
* **Solution minimale** : Remplacer `height: 65px;` par `min-height: 65px;` (ou `height: calc(65px + env(safe-area-inset-bottom));`).

### B. Audio Panel (`.audio-panel`)
* **Composant / Fichier** : `src/app/globals.css` (ligne ~566)
* **Comportement actuel** : Panel fixé en bas (`bottom: 0`) avec un padding fixe `padding: 14px 20px 22px;`.
* **Problème (P1)** : L'indicateur Home d'iOS se superposera exactement sur les contrôles audio et la barre de progression. L'utilisateur risque de fermer l'application au lieu de mettre sur pause.
* **Solution minimale** : Appliquer `padding-bottom: calc(22px + env(safe-area-inset-bottom));`.

### C. Modals/Dialogs en Bottom Sheet (`.modal-sheet`)
* **Composant / Fichier** : `src/app/globals.css` (ligne ~988)
* **Comportement actuel** : Padding défini statiquement à `padding: 20px 24px 30px;`.
* **Problème (P1)** : Pour les modales affichées en bas de l'écran, le Home Indicator va recouvrir les boutons de validation situés au bas de la modale.
* **Solution minimale** : Utiliser `padding-bottom: calc(30px + env(safe-area-inset-bottom));`.

## 4. Fichiers et lignes concernés
* `src/app/globals.css`
  * `~L988-1000` : `.modal-sheet`
  * `~L1020-1036` : `.bottom-nav`
  * `~L565-580` : `.audio-panel`
* `src/components/FuragoApp.tsx`
  * `~L3967` : Modale Nouvelle liste (`dialog.new-list-dialog`)
  * `~L4049` : Modale Newsletter (`dialog.lead-dialog`)

## 5. Correctifs recommandés (Solution minimale)

Aucun changement dans le composant React n'est strictement requis si l'on gère bien le CSS.
Dans `src/app/globals.css` :

```css
/* 1. Correction Modal & Clavier */
.modal-sheet {
  max-height: 85dvh; /* Mieux géré par les navigateurs modernes avec clavier */
  overflow-y: auto;  /* INDISPENSABLE pour voir tout le contenu si masqué */
  padding-bottom: calc(30px + env(safe-area-inset-bottom)); /* Safe Area */
}

/* 2. Correction Bottom Navigation */
.bottom-nav {
  /* height: 65px; <- À SUPPRIMER */
  min-height: 65px;
  padding-bottom: env(safe-area-inset-bottom);
}

/* 3. Correction Audio Panel */
.audio-panel {
  padding-bottom: calc(22px + env(safe-area-inset-bottom));
}
```

## 6. Risques / régressions possibles
* **App Shell Padding** : Si la hauteur totale de `.bottom-nav` augmente sur iPhone X+, il faudra s'assurer que l'espacement au bas de la page (`.app-shell` ou `body` avec `padding-bottom: 85px;` ligne ~46) est suffisant pour que le texte ne se retrouve pas caché sous la barre de navigation. Il conviendrait de le modifier en `padding-bottom: calc(85px + env(safe-area-inset-bottom));`.
* **Overflow de Modal** : L'ajout de `overflow-y: auto` sur `.modal-sheet` pourrait altérer l'affichage d'éléments nécessitant de déborder visuellement (ex: dropdowns, tooltips), bien que rien dans l'audit ne l'indique.

## 7. Ordre d'implémentation recommandé
1. Appliquer les correctifs liés aux **Safe Areas** (`.bottom-nav`, `.audio-panel`, `padding` du bas des pages).
2. Appliquer les correctifs pour la **gestion du Clavier Virtuel** (`overflow-y` et `dvh` sur `.modal-sheet`).
3. Tester manuellement sur un simulateur iOS (Safari) et Android (Chrome) pour vérifier la bonne réactivité de la modale "Nouvelle liste" centrée.

## 8. Conclusion
La quasi-totalité des problèmes d'utilisabilité P1 sur mobile liés au clavier et aux zones de sécurité proviennent d'une stylisation CSS trop rigide (absence d'overflow, hauteurs statiques, `vh` strict) non adaptée aux comportements intrinsèques des navigateurs mobiles modernes. Les corrections recommandées sont purement déclaratives et n'impliquent pas de toucher à la logique métier ni d'opérer un refactor lourd. L'audit confirme qu'un correctif local au niveau de `globals.css` est suffisant.
