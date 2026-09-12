const DATA_URL = "https://kohaiducode.github.io/furago-data/articles.json";

// Polyfill pour éviter les crashs si speechSynthesis n'est pas supporté (ex: certains WebViews Android)
if (typeof window.speechSynthesis === 'undefined') {
    window.speechSynthesis = {
        getVoices: () => [],
        speak: async (utterance) => {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
                try {
                    if (utterance.onstart) utterance.onstart();
                    let opts = {
                        text: utterance.text,
                        lang: utterance.lang || 'fr-FR',
                        rate: utterance.rate || 1.0,
                    };
                    if (utterance.voice && utterance.voice._originalIndex !== undefined) {
                        opts.voice = utterance.voice._originalIndex;
                    }
                    await window.Capacitor.Plugins.TextToSpeech.speak(opts);
                    if (utterance.onend) utterance.onend();
                } catch(e) {
                    console.error("TTS Plugin Error:", e);
                    if (utterance.onerror) utterance.onerror(e);
                    if (utterance.onend) utterance.onend();
                }
            } else {
                if (utterance.onend) utterance.onend();
            }
        },
        cancel: async () => {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
                await window.Capacitor.Plugins.TextToSpeech.stop();
            }
        },
        pause: () => {},
        resume: () => {},
        onvoiceschanged: null
    };
}
if (typeof window.SpeechSynthesisUtterance === 'undefined') {
    window.SpeechSynthesisUtterance = function(text) {
        this.text = text;
        this.lang = 'fr-FR';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.voice = null;
        this.onend = null;
        this.onerror = null;
        this.onstart = null;
        this.onboundary = null;
    };
}
// État Global
let currentArticles = [];
let categories = new Set();
let globalLevel = "A1"; 
let globalCategory = "ALL";
let currentArticleData = null; 

// État Audio
let currentQueueIndex = 0;
let ttsQueue = [];
let currentUtterance = null; 
let isPlaying = false;
let isPaused = false;
let preferredVoice = null;

// État Quiz
let currentQuizData = [];
let currentQuizIndex = 0;
let currentQuizScore = 0;

// Icônes SVG
const iconPlay = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const iconPause = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

// Éléments DOM
const loader = document.getElementById('loader');
const homeView = document.getElementById('home-view');
const readingView = document.getElementById('reading-view');
const navArticles = document.getElementById('nav-articles');
const wordListView = document.getElementById('word-list-view');
const navWords = document.getElementById('nav-words');
const backBtn = document.getElementById('back-btn');
const articleList = document.getElementById('article-list');
const globalLevelBtn = document.getElementById('global-level-btn');
const globalCategoryBtn = document.getElementById('global-category-btn');
const filterModal = document.getElementById('filter-selector-modal');
const filterModalBody = document.getElementById('filter-modal-body');
const filterModalTitle = document.getElementById('filter-modal-title');
const filterOptionsContainer = document.getElementById('filter-options-container');

// DOM Lecture
const articleHero = document.getElementById('article-hero');
const articleImage = document.getElementById('article-image');
const articleTitle = document.getElementById('article-title');
const articleMeta = document.getElementById('article-meta');
const articleContent = document.getElementById('article-content');
const quizSection = document.getElementById('quiz-section');
const quizContainer = document.getElementById('quiz-container');

const btnPlayPause = document.getElementById('btn-play-pause');
const btnRestart = document.getElementById('btn-restart');
const btnPrevSentence = document.getElementById('btn-prev-sentence');
const btnNextSentence = document.getElementById('btn-next-sentence');
const audioSpeedSelect = document.getElementById('audio-speed-select');
const audioVoiceSelect = document.getElementById('audio-voice-select');
let allLocalFrVoices = [];

// 1. Initialisation
async function initApp() {
    initVoices(); 
    try {
        const response = await fetch(DATA_URL);
        const data = await response.json();
        
        currentArticles = data.articles.filter(a => Object.keys(a.levels).length > 0);
        
        // Sort articles by date descending (newest first)
        currentArticles.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });
        
        currentArticles.forEach(a => {
            if (a.category) categories.add(a.category.trim());
        });
        
        // Categories are populated dynamically when modal opens

        renderHome();
    } catch (error) {
        console.error(error);
        alert("Google Sheetsとの接続エラーが発生しました。");
    }
}

// 2. Gestion des voix de synthèse
function initVoices() {
    const loadVoices = async () => {
        let voices = (window.speechSynthesis && window.speechSynthesis.getVoices) ? window.speechSynthesis.getVoices() : [];
          voices.forEach((v, i) => v._originalIndex = i);
        
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech) {
            try {
                const res = await window.Capacitor.Plugins.TextToSpeech.getSupportedVoices();
                if (res && res.voices) voices = res.voices;
                  voices.forEach((v, i) => v._originalIndex = i);
            } catch(e) { console.error(e); }
        }

        if (voices.length === 0) {
            setTimeout(loadVoices, 500);
            return;
        }

        allLocalFrVoices = voices.filter(v => v.lang.startsWith('fr') && !v.name.includes('Google'));
        if (allLocalFrVoices.length === 0) {
            allLocalFrVoices = voices.filter(v => v.lang.startsWith('fr'));
        }
        
        if (audioVoiceSelect) {
            audioVoiceSelect.innerHTML = '';
            if (allLocalFrVoices.length === 0) {
                audioVoiceSelect.innerHTML = '<option value="">Voix par défaut</option>';
            } else {
                let maleCount = 0;
                let femaleCount = 0;
                let otherCount = 0;
                
                allLocalFrVoices.forEach((v, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    let vName = v.name.toLowerCase();
                    let displayName = "";
                    
                    if (/hortense|julie|amelie|audrey|aurelie|alice|léa|roxane|carmit|vlf|vld|vla|female/i.test(vName)) {
                        femaleCount++;
                        displayName = `(女) ${femaleCount}`;
                    } else if (/paul|thomas|nicolas|david|henri|martin|claude|bernard|vle|vlc|vlb|male/i.test(vName)) {
                        maleCount++;
                        displayName = `(男) ${maleCount}`;
                    } else {
                        otherCount++;
                        displayName = `(他) ${v.name.replace('fr-FR', '').replace('fr-fr', '').substring(0, 12)}`;
                    }
                    option.textContent = `声：${displayName}`;
                    audioVoiceSelect.appendChild(option);
                });
                
                if (!preferredVoice) {
                    preferredVoice = allLocalFrVoices[0];
                }
            }
        }
    };
    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
}

if (audioVoiceSelect) {
    audioVoiceSelect.addEventListener('change', (e) => {
        preferredVoice = allLocalFrVoices[e.target.value];
        if (isPlaying) {
            isPaused = false;
            isPlaying = false;
            if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
            setTimeout(() => { playAudio(currentQueueIndex); }, 100);
        }
    });
}

// 3. Événements des Filtres (Modal)
function openFilterModal(type) {
    filterOptionsContainer.innerHTML = '';
    filterModal.classList.remove('hidden');
    
    // Animation d'entrée
    setTimeout(() => {
        filterModalBody.style.transform = 'translateY(0)';
    }, 10);

    const closeFilter = () => {
        filterModalBody.style.transform = 'translateY(100%)';
        setTimeout(() => filterModal.classList.add('hidden'), 300);
    };

    filterModal.onclick = (e) => {
        if (e.target === filterModal) closeFilter();
    };

    if (type === 'level') {
        filterModalTitle.textContent = 'レベルを選択 (Choisir un niveau)';
        filterOptionsContainer.classList.remove('filter-grid');
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
        levels.forEach(level => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option'; // On réutilise le style des boutons quiz
            btn.style.textAlign = 'center';
            if (globalLevel === level) {
                btn.style.borderColor = 'var(--primary)';
                btn.style.background = 'var(--primary-light)';
            }
            btn.textContent = `レベル ${level}`;
            btn.onclick = () => {
                globalLevel = level;
                globalLevelBtn.textContent = `レベル ${level}`;
                renderHome();
                closeFilter();
            };
            filterOptionsContainer.appendChild(btn);
        });
    } else if (type === 'category') {
        filterModalTitle.textContent = 'カテゴリーを選択 (Choisir une catégorie)';
        filterOptionsContainer.classList.add('filter-grid');
        const cats = ['ALL', ...Array.from(categories)];
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option';
            btn.style.textAlign = 'center';
            if (globalCategory === cat) {
                btn.style.borderColor = 'var(--primary)';
                btn.style.background = 'var(--primary-light)';
            }
            btn.textContent = cat === 'ALL' ? 'カテゴリー (すべて)' : cat;
            btn.onclick = () => {
                globalCategory = cat;
                globalCategoryBtn.textContent = cat === 'ALL' ? 'カテゴリー (すべて)' : cat;
                renderHome();
                closeFilter();
            };
            filterOptionsContainer.appendChild(btn);
        });
    }
}

globalLevelBtn.addEventListener('click', () => openFilterModal('level'));
globalCategoryBtn.addEventListener('click', () => openFilterModal('category'));

// 4. Afficher la liste filtrée
function renderHome() {
    loader.classList.add('hidden');
    readingView.classList.add('hidden');
    backBtn.classList.add('hidden');
    homeView.classList.remove('hidden');
    
    articleList.innerHTML = '';
    
    const filteredArticles = currentArticles.filter(article => {
        if (globalCategory !== "ALL" && article.category.trim() !== globalCategory) return false;
        if (!article.levels[globalLevel]) return false;
        return true;
    });
    
    if (filteredArticles.length === 0) {
        articleList.innerHTML = '<p style="text-align:center; padding:40px 20px; color:#8E8E93;">条件に一致する記事は見つかりませんでした。</p>';
        return;
    }

    filteredArticles.forEach((article, index) => {
        const levelData = article.levels[globalLevel];
        const displayTitle = levelData.title;

        // Convertir automatiquement les liens Google Drive en liens d'image directs
        let finalImageUrl = article.imageUrl ? article.imageUrl.trim() : '';
        const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
        if (finalImageUrl.match(driveRegex)) {
            finalImageUrl = `https://drive.google.com/thumbnail?id=${finalImageUrl.match(driveRegex)[1]}&sz=w1000`;
        }

        const li = document.createElement('li');
        li.className = 'article-card fade-in ' + (index === 0 ? 'hero-format' : 'list-format');
        li.style.animationDelay = `${index * 0.05}s`;
        li.style.opacity = '0'; // Assure que c'est invisible avant l'animation
        
        const imgHtml = finalImageUrl 
            ? `<div class="article-image-container"><img src="${finalImageUrl}" alt=""></div>` 
            : '';
        
        const dateFormatted = article.date ? new Date(article.date).toLocaleDateString('ja-JP') : '';
        const dateHtml = dateFormatted ? `<span style="color:#8E8E93; font-size: 0.8rem; margin-left: auto;">${dateFormatted}</span>` : '';
        
        li.innerHTML = `
            ${imgHtml}
            <div class="article-card-content">
                <h3 style="margin-bottom: 8px;">${displayTitle}</h3>
                <p class="meta" style="display:flex; align-items:center; gap:6px; margin: 0;">
                    <span class="badge">${globalLevel}</span> 
                    <span class="badge" style="background:#F2F2F7; color:#8E8E93;">${article.category || '一般'}</span>
                    ${dateHtml}
                </p>
            </div>
        `;
        li.addEventListener('click', () => openArticle(article, levelData));
        articleList.appendChild(li);
    });
}

// 5. Ouvrir l'article
function openArticle(article, levelData) {
    document.querySelector('.bottom-nav').classList.add('hidden');
    document.getElementById('audio-panel').classList.add('visible');
    currentArticleData = levelData;
    homeView.classList.add('hidden');
    readingView.classList.remove('hidden');
    backBtn.classList.remove('hidden');
    window.scrollTo(0, 0); 
    
    // Réinitialiser Audio
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    isPlaying = false;
    isPaused = false;
    currentQueueIndex = 0; ttsQueue = [];
    updateAudioButtonUI();
    
    // Convertir automatiquement les liens Google Drive en liens d'image directs
    let finalImageUrl = article.imageUrl ? article.imageUrl.trim() : '';
    const driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    if (finalImageUrl.match(driveRegex)) {
        finalImageUrl = `https://drive.google.com/thumbnail?id=${finalImageUrl.match(driveRegex)[1]}&sz=w1000`;
    }

    if (finalImageUrl) {
        articleImage.src = finalImageUrl;
        articleHero.style.display = 'block';
    } else {
        articleHero.style.display = 'none';
    }
    
    articleTitle.textContent = levelData.title;
    const dateFormatted = article.date ? new Date(article.date).toLocaleDateString('ja-JP') : '';
    const dateHtml = dateFormatted ? `<span style="color:#8E8E93; font-size: 0.85rem; margin-left: auto;">${dateFormatted}</span>` : '';
    articleMeta.style.display = 'flex';
    articleMeta.style.alignItems = 'center';
    articleMeta.style.gap = '8px';
    articleMeta.style.marginTop = '12px';
    articleMeta.innerHTML = `<span class="badge" style="font-size:0.9rem;">${globalLevel}</span> <span class="badge" style="background:#F2F2F7; color:#8E8E93; font-size:0.9rem;">${article.category || '一般'}</span>${dateHtml}`;
    
    // Rendu initial sans surlignage
    renderArticleHTML(levelData.content, -1, 0);
    
    startQuiz(levelData.quiz);
}

// Fonction utilitaire pour générer le HTML de l'article avec ou sans surlignage
function renderArticleHTML(text, highlightStart = -1, highlightLength = 0) {
    if (!text) return;
    let html = '';
    let currentIndex = 0;
    
    const paragraphs = text.split('\n');
    
    paragraphs.forEach(pText => {
        if (pText.trim() === '') {
            currentIndex += pText.length + 1; // +1 pour le retour à la ligne
            return;
        }
        
        const pStart = currentIndex;
        const pEnd = currentIndex + pText.length;
        
        if (highlightStart >= pStart && highlightStart < pEnd) {
            // Le surlignage se trouve dans ce paragraphe
            const localStart = highlightStart - pStart;
            const localLength = highlightLength;
            
            const before = pText.substring(0, localStart);
            const hl = pText.substring(localStart, localStart + localLength);
            const after = pText.substring(localStart + localLength);
            
            html += `<p>${before}<span class="tts-highlight">${hl}</span>${after}</p>`;
        } else {
            html += `<p>${pText}</p>`;
        }
        
        currentIndex += pText.length + 1;
    });
    
    articleContent.innerHTML = html;
}

// 6. Gestion du Quiz (Question par Question)
function startQuiz(quizArray) {
    quizContainer.innerHTML = '';
    if (!quizArray || quizArray.length === 0) {
        quizSection.classList.add('hidden');
        return;
    }
    
    quizSection.classList.remove('hidden');
    currentQuizData = quizArray;
    currentQuizIndex = 0;
    currentQuizScore = 0;
    
    renderCurrentQuizQuestion();
}

function renderCurrentQuizQuestion() {
    quizContainer.innerHTML = '';
    
    // Si toutes les questions sont répondues -> Afficher le score
    if (currentQuizIndex >= currentQuizData.length) {
        const total = currentQuizData.length;
        // Déterminer le message
        let msg = "もう一度挑戦しよう！"; // "Retente ta chance"
        if (currentQuizScore === total) msg = "素晴らしい！"; // "Bravo!"
        else if (currentQuizScore >= total / 2) msg = "よくできました！"; // "Bien joué"
        
        quizContainer.innerHTML = `
            <div class="quiz-card fade-in" style="text-align:center;">
                <h4 style="font-size:1.8rem; margin-bottom:12px; color:var(--primary);">スコア: ${currentQuizScore} / ${total}</h4>
                <p style="font-size:1.2rem; color:var(--text-main); font-weight:bold; margin-bottom: 24px;">${msg}</p>
                <button id="btn-retry-quiz" style="background:var(--primary); color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:bold; cursor:pointer;">もう一度やる</button>
            </div>
        `;
        document.getElementById('btn-retry-quiz').addEventListener('click', () => {
            currentQuizIndex = 0;
            currentQuizScore = 0;
            renderCurrentQuizQuestion();
        });
        return;
    }
    
    // Afficher la question courante
    const q = currentQuizData[currentQuizIndex];
    const qDiv = document.createElement('div');
    qDiv.className = 'quiz-card fade-in';
    
    qDiv.innerHTML = `
        <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:8px; font-weight:bold;">質問 ${currentQuizIndex + 1} / ${currentQuizData.length}</p>
        <p class="quiz-question">${q.text}</p>
    `;
    
    const optionsList = document.createElement('div');
    
    ['A', 'B', 'C', 'D'].forEach(key => {
        if (!q.options[key]) return;
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = `${key}. ${q.options[key]}`;
        
        btn.addEventListener('click', () => {
            // Empêcher les autres clics
            Array.from(optionsList.children).forEach(b => b.disabled = true);
            
            const isCorrect = (key === q.answer.trim().toUpperCase());
            if (isCorrect) {
                btn.classList.add('correct');
                currentQuizScore++;
            } else {
                btn.classList.add('incorrect');
                // Illuminer la bonne réponse
                Array.from(optionsList.children).forEach(b => {
                    if (b.textContent.startsWith(q.answer.trim().toUpperCase())) {
                        b.classList.add('correct');
                    }
                });
            }
            
            // Animation et texte de feedback
            const feedback = document.createElement('div');
            feedback.className = 'quiz-feedback-text';
            if (isCorrect) {
                feedback.classList.add('text-correct');
                feedback.textContent = '⭕ 正解！'; // Bonne réponse
            } else {
                feedback.classList.add('text-incorrect');
                feedback.textContent = '❌ 不正解...'; // Mauvaise réponse
            }
            qDiv.appendChild(feedback);
            
            // Attendre 2 secondes puis passer à la question suivante
            setTimeout(() => {
                currentQuizIndex++;
                renderCurrentQuizQuestion();
            }, 2000);
        });
        optionsList.appendChild(btn);
    });
    qDiv.appendChild(optionsList);
    quizContainer.appendChild(qDiv);
}

// 7. Lecteur Audio avec file d'attente (TTS Queue)
const audioPanel = document.getElementById('audio-panel');
const btnCloseAudio = document.getElementById('btn-close-audio');
const audioProgressBar = document.getElementById('audio-progress-bar');


function buildTtsQueue(text) {
    ttsQueue = [];
    let currentIndex = 0;
    const regex = /[^.!?\n]+[.!?\n]*\s*/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[0].trim().length > 0) {
            ttsQueue.push({
                text: match[0],
                start: currentIndex,
                length: match[0].length
            });
        }
        currentIndex += match[0].length;
    }
}

function updateAudioButtonUI() {
    if (isPlaying && !isPaused) {
        btnPlayPause.innerHTML = `${iconPause}`; 
        btnPlayPause.style.background = '#FF9500'; 
        btnPlayPause.style.color = '#FFFFFF';
        
    } else if (isPaused) {
        btnPlayPause.innerHTML = `${iconPlay}`; 
        btnPlayPause.style.background = '#34C759'; 
        btnPlayPause.style.color = '#FFFFFF';
        
    } else {
        btnPlayPause.innerHTML = `${iconPlay}`; 
        btnPlayPause.style.background = '#5E5CE6'; 
        btnPlayPause.style.color = '#FFFFFF';
        
    }
    
    // Update progress bar
    if (ttsQueue.length > 0) {
        const progress = ((currentQueueIndex) / ttsQueue.length) * 100;
        audioProgressBar.style.width = `${progress}%`;
    } else {
        audioProgressBar.style.width = `0%`;
    }
}

function playNextInQueue() {
    if (!isPlaying || isPaused) return;
    
    if (currentQueueIndex >= ttsQueue.length) {
        isPlaying = false;
        isPaused = false;
        currentQueueIndex = 0;
        updateAudioButtonUI();
        if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
        return;
    }

    const item = ttsQueue[currentQueueIndex];
    updateAudioButtonUI();
    
    if (currentArticleData) renderArticleHTML(currentArticleData.content, item.start, item.length);

    currentUtterance = new SpeechSynthesisUtterance(item.text);
    if (preferredVoice) currentUtterance.voice = preferredVoice;
    currentUtterance.lang = 'fr-FR'; 
    currentUtterance.rate = parseFloat(audioSpeedSelect.value); 
    
    currentUtterance.onend = () => {
        if (isPlaying && !isPaused) {
            currentQueueIndex++;
            playNextInQueue();
        }
    };
    
    currentUtterance.onerror = (e) => {
        console.error("TTS Error:", e);
        isPlaying = false;
        isPaused = false;
        updateAudioButtonUI();
        if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
    };

    if (window.speechSynthesis && window.speechSynthesis.speak) window.speechSynthesis.speak(currentUtterance);
}

function playAudio(startIndex = -1) {
    if (startIndex !== -1) {
        currentQueueIndex = startIndex;
    }
    
    if (isPaused) {
        isPaused = false;
        isPlaying = true;
        updateAudioButtonUI();
        playNextInQueue();
        return;
    }
    
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    
    if (!currentArticleData || !currentArticleData.content) return;
    
    if (ttsQueue.length === 0) {
        buildTtsQueue(currentArticleData.content);
    }
    
    isPlaying = true;
    isPaused = false;
    updateAudioButtonUI();
    playNextInQueue();
}

function pauseAudio() {
    isPaused = true;
    isPlaying = false;
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel(); 
    updateAudioButtonUI();
}

btnPlayPause.addEventListener('click', () => {
    if (isPlaying && !isPaused) {
        pauseAudio();
    } else {
        playAudio();
    }
});

btnRestart.addEventListener('click', () => {
    isPaused = false;
    isPlaying = false;
    currentQueueIndex = 0;
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
    setTimeout(() => { playAudio(); }, 100);
});

audioSpeedSelect.addEventListener('change', () => {
    if (isPlaying) {
        isPaused = false;
        isPlaying = false;
        if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
        setTimeout(() => { playAudio(currentQueueIndex); }, 100);
    }
});

// UI Bottom Sheet


// Bouton Retour
backBtn.addEventListener('click', () => {
    document.querySelector('.bottom-nav').classList.remove('hidden');
    audioPanel.classList.remove('visible');
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
    renderHome();
});

// Lancement

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}


// Gestion du bouton retour physique (Android)
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
        if (!readingView.classList.contains('hidden')) {
            if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
            if (currentArticleData) renderArticleHTML(currentArticleData.content, -1, 0);
            renderHome();
        } else {
            window.Capacitor.Plugins.App.exitApp();
        }
    });
}

// -----------------------------------------------------
// Dictionnaire Interactif (Surlignage)
// -----------------------------------------------------
const dictPopup = document.getElementById('dict-popup');
const dictWord = document.getElementById('dict-word');
const dictTranslation = document.getElementById('dict-translation');
const dictAudioBtn = document.getElementById('dict-audio-btn');

let currentDictText = "";
const translationCache = new Map(); // Cache pour mémoriser les traductions

// Fermer le popup si on clique ailleurs
document.addEventListener('pointerdown', (e) => {
    if (dictPopup && !dictPopup.contains(e.target)) {
        dictPopup.classList.add('hidden');
    }
});

// Ne déclencher la traduction QUE lorsqu'on relâche la souris/le doigt
document.addEventListener('pointerup', (e) => {
    if (readingView.classList.contains('hidden')) return;
    if (dictPopup && dictPopup.contains(e.target)) return; // Ignorer les clics sur le bouton audio

    setTimeout(async () => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (!text || text.length === 0 || text.length > 50) return;

        // Calcul de la position
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        dictWord.textContent = text;
        currentDictText = text;
        dictPopup.classList.remove('hidden');
        
        let topPos = rect.top + window.scrollY - dictPopup.offsetHeight - 14;
        let leftPos = rect.left + window.scrollX + (rect.width / 2);
        
        const minLeft = (dictPopup.offsetWidth / 2) + 10;
        const maxLeft = window.innerWidth - (dictPopup.offsetWidth / 2) - 10;
        if(leftPos < minLeft) leftPos = minLeft;
        if(leftPos > maxLeft) leftPos = maxLeft;

        if (topPos < window.scrollY + 10) {
            topPos = rect.bottom + window.scrollY + 14;
            dictPopup.classList.add('arrow-top');
        } else {
            dictPopup.classList.remove('arrow-top');
        }

        dictPopup.style.top = `${topPos}px`;
        dictPopup.style.left = `${leftPos}px`;

        // Utilisation du cache pour éviter de spammer l'API
        const cacheKey = text.toLowerCase();
        if (translationCache.has(cacheKey)) {
            dictTranslation.textContent = translationCache.get(cacheKey);
            return;
        }

        dictTranslation.innerHTML = '<span style="color:#8E8E93; font-size:0.9rem;">翻訳中...</span>';

        // Appel API uniquement si pas en cache
        try {
            // On utilise "client=dict-chrome-ex" qui a des limites beaucoup plus souples
            const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=fr&tl=ja&dt=t&q=${encodeURIComponent(text)}`);
            if (!res.ok) throw new Error("API Limit");
            const data = await res.json();
            const translation = data[0].map(item => item[0]).join('');
            
            dictTranslation.textContent = translation;
            translationCache.set(cacheKey, translation); // Sauvegarde dans le cache
            
            if (!dictPopup.classList.contains('arrow-top')) {
                dictPopup.style.top = `${rect.top + window.scrollY - dictPopup.offsetHeight - 14}px`;
            }
        } catch (err) {
            dictTranslation.textContent = '一時的な制限 (Trop de requêtes)';
        }
    }, 150); // Léger délai pour s'assurer que la sélection système est finie
});

// Écouter le bouton audio du dictionnaire
if (dictAudioBtn) {
    dictAudioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentDictText) return;
        
        const utterance = new SpeechSynthesisUtterance(currentDictText);
        utterance.lang = 'fr-FR';
        if (preferredVoice) utterance.voice = preferredVoice;
        // On lit à vitesse normale
        utterance.rate = 1.0; 
        if (window.speechSynthesis && window.speechSynthesis.speak) window.speechSynthesis.speak(utterance);
    });
}

// -----------------------------------------------------
// Enregistrement des mots (単語帳)
// -----------------------------------------------------
const dictSaveBtn = document.getElementById('dict-save-btn');
let wordLists = JSON.parse(localStorage.getItem('furago_lists')) || [{id: 'default', name: 'デフォルト (Tous les mots)'}];
if (!Array.isArray(wordLists) || wordLists.length === 0) {
    wordLists = [{id: 'default', name: 'デフォルト (Tous les mots)'}];
    localStorage.setItem('furago_lists', JSON.stringify(wordLists));
}

let savedWords = JSON.parse(localStorage.getItem('furago_words')) || [];
if (!Array.isArray(savedWords)) savedWords = [];

let currentListId = 'default';

const listSelectorModal = document.getElementById('list-selector-modal');
const listSelectorContainer = document.getElementById('list-selector-container');
const listSelectorCancel = document.getElementById('list-selector-cancel');

if (listSelectorCancel) {
    listSelectorCancel.addEventListener('click', () => {
        listSelectorModal.classList.add('hidden');
    });
}

if (dictSaveBtn) {
    dictSaveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!currentDictText) return;
        const translationText = dictTranslation.textContent;
        // Ne pas enregistrer si on est encore en chargement ou en erreur
        if (translationText.includes('翻訳中') || translationText.includes('エラー') || translationText.includes('制限')) {
            alert("Veuillez patienter pendant la traduction avant d'enregistrer.");
            return;
        }
        
        // Ouvrir la modale
        if (listSelectorContainer) {
            listSelectorContainer.innerHTML = '';
            wordLists.forEach(list => {
                const btn = document.createElement('button');
                btn.style.padding = '12px 16px';
                btn.style.background = 'var(--bg)';
                btn.style.color = 'var(--text-main)';
                btn.style.border = '1px solid var(--border)';
                btn.style.borderRadius = '12px';
                btn.style.fontSize = '1.05rem';
                btn.style.cursor = 'pointer';
                btn.style.display = 'flex';
                btn.style.justifyContent = 'space-between';
                btn.style.alignItems = 'center';
                
                // Nombre de mots dans cette liste pour info
                const wordsCount = savedWords.filter(w => w.listId === list.id).length;
                
                btn.innerHTML = `
                    <span style="font-weight: bold;">${list.name}</span>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">${wordsCount} mots</span>
                `;
                
                btn.addEventListener('click', () => {
                    listSelectorModal.classList.add('hidden'); // Fermer la modale
                    
                    const selectedListId = list.id;
                    const exists = savedWords.some(w => w.fr.toLowerCase() === currentDictText.toLowerCase() && w.listId === selectedListId);
                    
                    if (!exists) {
                        savedWords.push({
                            fr: currentDictText,
                            ja: translationText,
                            listId: selectedListId,
                            date: new Date().toISOString()
                        });
                        localStorage.setItem('furago_words', JSON.stringify(savedWords));
                        
                        // Animation visuelle de succès
                        dictSaveBtn.style.color = '#FF9500'; // Orange
                        dictSaveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
                        
                        // Rafraîchir les listes en arrière-plan si on y est
                        renderListsOverview();
                    } else {
                        alert("Ce mot est déjà dans cette liste.");
                    }
                });
                
                listSelectorContainer.appendChild(btn);
            });
            listSelectorModal.classList.remove('hidden');
        }
    });
}

// -----------------------------------------------------
// Gestion des Vues : Listes (Dossiers) et Mots
// -----------------------------------------------------
const listsOverview = document.getElementById('lists-overview');
const listDetailView = document.getElementById('list-detail-view');
const btnCreateList = document.getElementById('btn-create-list');
const btnBackToLists = document.getElementById('btn-back-to-lists');

if (btnCreateList) {
    btnCreateList.addEventListener('click', () => {
        const listName = prompt("Nouveau nom de liste (ex: Verbes, Chapitre 1) :");
        if (listName && listName.trim() !== '') {
            const newList = { id: 'list_' + Date.now(), name: listName.trim() };
            wordLists.push(newList);
            localStorage.setItem('furago_lists', JSON.stringify(wordLists));
            renderListsOverview();
        }
    });
}

if (btnBackToLists) {
    btnBackToLists.addEventListener('click', () => {
        listDetailView.classList.add('hidden');
        listsOverview.classList.remove('hidden');
        renderListsOverview();
    });
}

function renderListsOverview() {
    const container = document.getElementById('lists-container');
    if (!container) return;
    container.innerHTML = '';
    
    // S'assurer qu'on n'a pas de mots sans listId (mise à jour pour les anciens utilisateurs)
    savedWords.forEach(w => { if(!w.listId) w.listId = 'default'; });
    
    wordLists.forEach(list => {
        const wordsInList = savedWords.filter(w => w.listId === list.id);
        const card = document.createElement('div');
        card.className = 'quiz-card fade-in';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.cursor = 'pointer';
        
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="background:var(--primary-light); color:var(--primary); width:40px; height:40px; border-radius:8px; display:flex; justify-content:center; align-items:center;">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <div>
                    <h3 style="color:var(--text-main); font-size:1.1rem; margin-bottom:2px;">${list.name}</h3>
                    <span style="color:var(--text-muted); font-size:0.85rem;">${wordsInList.length} mots</span>
                </div>
            </div>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        `;
        
        card.addEventListener('click', () => {
            currentListId = list.id;
            document.getElementById('current-list-title').textContent = list.name;
            listsOverview.classList.add('hidden');
            listDetailView.classList.remove('hidden');
            renderSavedWords(list.id);
        });
        
        container.appendChild(card);
    });
}

function renderSavedWords(listId) {
    const container = document.getElementById('saved-words-container');
    if (!container) return;
    container.innerHTML = '';
    
    const wordsInList = savedWords.filter(w => w.listId === listId);
    
    if (wordsInList.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom:16px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                <p>Cette liste est vide.<br>Sélectionnez un mot dans un article pour l'ajouter !</p>
            </div>`;
        return;
    }
    
    // Afficher du plus récent au plus ancien
    const reversedWords = [...wordsInList].reverse();
    
    reversedWords.forEach((word) => {
        const card = document.createElement('div');
        card.className = 'quiz-card fade-in';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        
        // Trouver le vrai index dans le tableau global pour la suppression
        const realIndex = savedWords.findIndex(w => w.fr === word.fr && w.listId === word.listId);
        
        card.innerHTML = `
            <div>
                <h3 style="color:var(--primary); margin-bottom:4px; font-size:1.2rem;">${word.fr}</h3>
                <p style="font-weight:600; color:var(--text-main); font-size: 1rem;">${word.ja}</p>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-play-word" data-word="${word.fr.replace(/"/g, '&quot;')}" style="background:var(--bg); border:1px solid var(--border); color:var(--green); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <button class="btn-delete-word" data-index="${realIndex}" style="background:var(--bg); border:1px solid var(--border); color:var(--red); border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    
    // Événements lecture audio
    document.querySelectorAll('.btn-play-word').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const textToRead = e.currentTarget.getAttribute('data-word');
            const utterance = new SpeechSynthesisUtterance(textToRead);
            utterance.lang = 'fr-FR';
            if (preferredVoice) utterance.voice = preferredVoice;
            if (window.speechSynthesis && window.speechSynthesis.speak) window.speechSynthesis.speak(utterance);
        });
    });

    // Événements suppression
    document.querySelectorAll('.btn-delete-word').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-index'));
            savedWords.splice(idx, 1);
            localStorage.setItem('furago_words', JSON.stringify(savedWords));
            renderSavedWords(listId); // Rafraîchir la liste
            renderListsOverview(); // Mettre à jour le compteur global
        });
    });
}

// -----------------------------------------------------
// Navigation Bas de page
// -----------------------------------------------------
function switchNav(activeBtn, viewToShow) {
    // 1. Désactiver tous les boutons nav
    [navArticles, navWords].forEach(btn => btn.classList.remove('active'));
    // 2. Cacher toutes les vues principales
    [homeView, readingView, wordListView].forEach(v => v.classList.add('hidden'));
    
    // 3. Activer la bonne vue et le bon bouton
    activeBtn.classList.add('active');
    viewToShow.classList.remove('hidden');
    
    // 4. Couper l'audio en cours
    if (window.speechSynthesis && window.speechSynthesis.cancel) window.speechSynthesis.cancel();
    
    // 5. Cacher le bouton retour si on n'est pas dans un article
    if (viewToShow !== readingView) {
        backBtn.classList.add('hidden');
    }
}

if (navArticles) {
    navArticles.addEventListener('click', () => {
        switchNav(navArticles, homeView);
        // On s'assure d'être sur la homeView et non readingView si on clique "Articles"
        renderHome();
    });
}

if (navWords) {
    navWords.addEventListener('click', () => {
        try {
            switchNav(navWords, wordListView);
            listsOverview.classList.remove('hidden');
            listDetailView.classList.add('hidden');
            renderListsOverview();
        } catch (err) {
            document.body.innerHTML += `<div style="position:fixed; top:0; left:0; right:0; background:red; color:white; z-index:9999; padding:20px;">ERREUR NAV: ${err.message} <br> ${err.stack}</div>`;
        }
    });
}


if (btnPrevSentence) {
    btnPrevSentence.addEventListener('click', () => {
        if (currentQueueIndex > 0) {
            currentQueueIndex--;
            if (isPlaying) {
                if(window.speechSynthesis) window.speechSynthesis.cancel();
                playNextInQueue();
            } else {
                updateProgressUI();
                highlightCurrentSentence();
            }
        }
    });
}
if (btnNextSentence) {
    btnNextSentence.addEventListener('click', () => {
        if (currentQueueIndex < ttsQueue.length - 1) {
            currentQueueIndex++;
            if (isPlaying) {
                if(window.speechSynthesis) window.speechSynthesis.cancel();
                playNextInQueue();
            } else {
                updateProgressUI();
                highlightCurrentSentence();
            }
        }
    });
}
