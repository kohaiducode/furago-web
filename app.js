// URL de notre Gist GitHub
const DATA_URL = "https://gist.githubusercontent.com/kohaiducode/74912233ad39c4253823a67eaabb04b7/raw/923ce5c01c9b32f3ff132b4cc8aa09cec1867269/articles.json";

// État de l'application
let currentArticles = [];
let currentArticle = null;
let currentDictionary = {};

// Éléments du DOM (l'interface HTML)
const loader = document.getElementById('loader');
const homeView = document.getElementById('home-view');
const readingView = document.getElementById('reading-view');
const backBtn = document.getElementById('back-btn');
const appTitle = document.getElementById('app-title');
const articleList = document.getElementById('article-list');

const articleTitle = document.getElementById('article-title');
const articleMeta = document.getElementById('article-meta');
const articleContent = document.getElementById('article-content');
const toggleHighlight = document.getElementById('toggle-highlight');

const translationPanel = document.getElementById('translation-panel');
const transWord = document.getElementById('trans-word');
const transGender = document.getElementById('trans-gender');
const transPronunciation = document.getElementById('trans-pronunciation');
const transMeaning = document.getElementById('trans-meaning');
const btnListen = document.getElementById('btn-listen');
const audioBar = document.getElementById('audio-bar');
const btnPlayAll = document.getElementById('btn-play-all');

// 1. Initialisation : télécharger les données
async function initApp() {
    try {
        const response = await fetch(DATA_URL);
        const data = await response.json();
        currentArticles = data.articles;
        
        renderHome();
    } catch (error) {
        console.error("Erreur de téléchargement :", error);
        alert("Impossible de télécharger les articles. Vérifiez votre connexion.");
    }
}

// 2. Afficher la liste d'accueil
function renderHome() {
    loader.classList.add('hidden');
    readingView.classList.add('hidden');
    backBtn.classList.add('hidden');
    translationPanel.classList.add('hidden');
    audioBar.classList.add('hidden');
    
    appTitle.textContent = "Furago";
    homeView.classList.remove('hidden');
    
    articleList.innerHTML = ''; // Nettoyer la liste
    
    currentArticles.forEach(article => {
        const li = document.createElement('li');
        li.className = 'article-card';
        li.innerHTML = `
            <h3>${article.title}</h3>
            <p class="meta">
                <span class="badge">${article.level}</span> - ${article.date}
            </p>
        `;
        li.addEventListener('click', () => openArticle(article));
        articleList.appendChild(li);
    });
}

// 3. Ouvrir un article
function openArticle(article) {
    currentArticle = article;
    homeView.classList.add('hidden');
    readingView.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    audioBar.classList.remove('hidden');
    translationPanel.classList.add('hidden');
    
    appTitle.textContent = "Lecture";
    articleTitle.textContent = article.title;
    articleMeta.textContent = `${article.date} • ${article.level}`;
    
    // Convertir le dictionnaire en un format facile à chercher (clé = mot en minuscules)
    currentDictionary = {};
    article.dictionary.forEach(entry => {
        // Enlever la ponctuation pour la clé de recherche
        const cleanWord = entry.word.toLowerCase().replace(/[.,!?]/g, "");
        currentDictionary[cleanWord] = entry;
    });

    // Rendre le texte interactif
    renderArticleContent(article.content);
}

// Transforme le texte simple en texte où chaque mot est cliquable
function renderArticleContent(text) {
    // Séparer les paragraphes
    const paragraphs = text.split('\n').filter(p => p.trim() !== '');
    
    articleContent.innerHTML = '';
    
    paragraphs.forEach(pText => {
        const pElement = document.createElement('p');
        
        // Séparer les mots tout en gardant les espaces (avec une astuce Regex simple)
        // On découpe par espace, puis on crée un petit bout de HTML "span" pour chaque mot.
        const words = pText.split(' ');
        
        words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[.,!?]/g, "");
            const span = document.createElement('span');
            span.textContent = word + ' ';
            
            // Si le mot est dans le dictionnaire, on lui donne une classe spéciale
            if (currentDictionary[cleanWord]) {
                span.className = 'word-clickable';
                span.dataset.wordId = cleanWord;
                span.addEventListener('click', (e) => showTranslation(cleanWord, e));
            }
            
            pElement.appendChild(span);
        });
        
        articleContent.appendChild(pElement);
    });
}

// 4. Afficher la traduction
function showTranslation(wordId, event) {
    // Si on clique sur un mot, empêcher la page de défiler ou de cliquer ailleurs
    event.stopPropagation();
    
    const entry = currentDictionary[wordId];
    if (!entry) return;
    
    transWord.textContent = entry.word;
    transGender.textContent = entry.gender;
    transPronunciation.textContent = entry.pronunciation;
    transMeaning.textContent = entry.translation;
    
    translationPanel.classList.remove('hidden');
    audioBar.classList.add('hidden'); // Cacher le bouton global
    
    // Configurer le bouton d'écoute du mot
    btnListen.onclick = () => speakFrench(entry.word);
}

// Cacher le panneau quand on clique ailleurs sur la page
document.addEventListener('click', () => {
    if (!readingView.classList.contains('hidden')) {
        translationPanel.classList.add('hidden');
        audioBar.classList.remove('hidden');
    }
});
// Empêcher le clic à l'intérieur du panneau de le fermer
translationPanel.addEventListener('click', (e) => e.stopPropagation());

// 5. Bascule "Mettre en évidence" (Highlight)
toggleHighlight.addEventListener('change', (e) => {
    if (e.target.checked) {
        articleContent.classList.add('highlight-active');
    } else {
        articleContent.classList.remove('highlight-active');
    }
});

// 6. Synthèse vocale (Text-to-Speech) intégré au navigateur
function speakFrench(text) {
    if ('speechSynthesis' in window) {
        // Arrêter ce qui est déjà en cours
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR'; // Voix française
        utterance.rate = 0.9; // Légèrement ralenti pour l'apprentissage
        
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Désolé, votre navigateur ne supporte pas la synthèse vocale.");
    }
}

// Bouton écouter tout
btnPlayAll.addEventListener('click', () => {
    if (currentArticle) {
        speakFrench(currentArticle.content);
    }
});

// Bouton retour
backBtn.addEventListener('click', () => {
    // Couper le son si on quitte
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    renderHome();
});

// Lancement au chargement de la page
window.addEventListener('DOMContentLoaded', initApp);
