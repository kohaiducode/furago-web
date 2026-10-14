<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architecture Map & Context Rules

Pour réduire la consommation de contexte, cibler précisément les fichiers pertinents sans ouvrir les orchestrateurs volumineux en entier :
- `src/components/FuragoApp.tsx` : Shell d'orchestration (navigation, popstate, userState, XP/SRS, analytics). Ne jamais lire en entier : utiliser `git grep` ou des extraits bornés.
- `src/features/home/HomeView.tsx` : Vue Accueil.
- `src/features/reading/ReadingView.tsx` & `src/types/article.ts` : Vue Lecture d'article, vocabulaire et quiz.
- `src/features/vocab-review/VocabReviewView.tsx` : Vue Révision SRS.
- `src/features/wordbook/WordbookView.tsx` : Vue Carnet de vocabulaire.
- `src/components/ProgressDashboard.tsx` & `src/lib/progress.ts` : Tableau de bord de progression.
- `src/components/DictionaryModal.tsx` & `src/lib/dictionary.ts` : Modale et service de dictionnaire.
- `src/components/NewsletterModal.tsx` & `src/lib/newsletter.ts` : Modale d'inscription et appels API Google Apps Script.
- `src/components/FilterModal.tsx` & `src/lib/category.ts` : Modale de filtre niveau/catégorie et normalisation des catégories.
- `src/hooks/useSpeechSynthesis.ts` : Moteur audio TTS (`window.speechSynthesis`).
- `src/lib/userState.ts` & `src/lib/srs.ts` : Persistance `localStorage`, migrations et algorithme SRS.
