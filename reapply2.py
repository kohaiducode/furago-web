import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Header & Lead Bar
header_old = """      {/* Top Bar - Capture d'emails (Lead Generation) */}
      {showLeadBar && (
        <div className="lead-bar">
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            新着記事・先行案内
          </span>
          <form className="lead-bar-form" onSubmit={handleOpenLeadModal}>
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="メールアドレス"
              className="lead-bar-input"
            />
            <button type="submit" className="lead-bar-btn">
              登録
            </button>
            <button
              type="button"
              onClick={() => setShowLeadBar(false)}
              aria-label="閉じる"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </form>
        </div>
      )}

      {/* App Header */}
      <header className="app-header">
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="戻る"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1>Furago</h1>
        {activeView === "reading" && (
          <button
            className="header-level-btn"
            onClick={() => setFilterModalType("level")}
          >
            レベル {globalLevel} ▾
          </button>
        )}
      </header>"""

header_new = """      {/* App Header (Redesigned for Professional UI/UX) */}
      <header className="app-header" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 100 }}>
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="Back"
            style={{ marginRight: '12px', padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--primary)', letterSpacing: '-0.5px' }}>{t.appTitle}</h1>
        
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', alignItems: 'center' }}>
            {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={() => setFilterModalType("level")}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}
            >
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel} ▾
            </button>
            )}
            <div style={{ position: 'relative' }}>
              <select 
                value={appLang} 
                onChange={(e) => setAppLang(e.target.value as AppLanguage)}
                style={{
                    appearance: 'none',
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "4px 24px 4px 10px",
                    color: "var(--text-main)",
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    outline: "none",
                    cursor: "pointer"
                }}
              >
                  <option value="ja">🇯🇵 JP</option>
                  <option value="en">🇬🇧 EN</option>
              </select>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            
            {showLeadBar && (
              <button 
                onClick={(e) => { e.preventDefault(); handleOpenLeadModal(e); }}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '16px', padding: '5px 12px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                {t.nav.register}
              </button>
            )}
        </div>
      </header>"""
content = content.replace(header_old, header_new)

# 2. Reading Article Header Title & Translations toggle
reading_old = """          <div className="article-header">
            <h2 lang="fr">{currentLevelData.title}</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "10px",
              }}
            >
              <span className="badge" style={{ fontSize: "0.85rem" }}>
                {globalLevel}
              </span>
              <span
                className="badge"
                style={{
                  background: "#E5E5EA",
                  color: "#636366",
                  fontSize: "0.85rem",
                }}
              >
                {currentArticle.category || "一般"}
              </span>
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "10px",
              }}
            >
              💡 単語をタップ（またはクリック）すると日本語の意味と文脈翻訳が表示されます
            </p>
          </div>

          <div className="article-content" lang="fr">
            {renderInteractiveContent(currentLevelData.content)}
          </div>"""

reading_new = """          <div className="article-header">
            <h2 lang="fr">{typeof currentLevelData.title === 'string' ? currentLevelData.title : currentLevelData.title?.fr}</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "10px",
              }}
            >
              <span className="badge" style={{ fontSize: "0.85rem" }}>
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel}
              </span>
              <span
                className="badge"
                style={{
                  background: "#E5E5EA",
                  color: "#636366",
                  fontSize: "0.85rem",
                  textTransform: "capitalize"
                }}
              >
                {typeof currentArticle.category === 'string' ? currentArticle.category : currentArticle.category?.[appLang] || "General"}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: "10px" }}>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                  }}
                >
                  💡 {appLang === 'ja' ? '単語をタップすると辞書が開きます' : 'Tap a word to open the dictionary'}
                </p>
                <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    style={{
                        background: showTranslation ? "var(--primary)" : "transparent",
                        color: showTranslation ? "white" : "var(--primary)",
                        border: "1px solid var(--primary)",
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer"
                    }}
                >
                    {showTranslation ? t.reading.hideTranslation : t.reading.showTranslation}
                </button>
            </div>
          </div>

          <div className="article-content">
            {renderInteractiveContent(currentLevelData.paragraphs)}
          </div>"""
content = content.replace(reading_old, reading_new)

# 3. Quiz translation logic
quiz_old = """          {/* Comprehension Quiz */}
          {currentLevelData.quiz && currentLevelData.quiz.length > 0 && (
            <div className="quiz-section">
              <h3>🧠 理解度クイズ</h3>
              {quizIndex >= currentLevelData.quiz.length ? (
                <div className="quiz-card fade-in" style={{ textAlign: "center" }}>
                  <h4
                    style={{
                      fontSize: "1.7rem",
                      marginBottom: "10px",
                      color: "var(--primary)",
                    }}
                  >
                    スコア: {quizScore} / {currentLevelData.quiz.length}
                  </h4>
                  <p
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      marginBottom: "20px",
                    }}
                  >
                    {quizScore === currentLevelData.quiz.length
                      ? "素晴らしい！🎉"
                      : quizScore >= currentLevelData.quiz.length / 2
                        ? "よくできました！👏"
                        : "もう一度挑戦しよう！💪"}
                  </p>
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setQuizScore(0);
                      setSelectedAnswer(null);
                    }}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    もう一度やる
                  </button>
                </div>
              ) : (
                (() => {
                  const q = currentLevelData.quiz[quizIndex];
                  const correctKey = q.answer.trim().toUpperCase();
                  return (
                    <div className="quiz-card fade-in" key={quizIndex}>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "0.88rem",
                          marginBottom: "8px",
                          fontWeight: 700,
                        }}
                      >
                        質問 {quizIndex + 1} / {currentLevelData.quiz.length}
                      </p>
                      <p className="quiz-question" lang="fr">
                        {q.text}
                      </p>
                      <div>
                        {["A", "B", "C", "D"].map((key) => {
                          if (!q.options[key]) return null;
                          const isChosen = selectedAnswer === key;
                          const isCorrectOption = key === correctKey;

                          let statusClass = "";
                          if (selectedAnswer !== null) {
                            if (isCorrectOption) statusClass = "correct";
                            else if (isChosen) statusClass = "incorrect";
                          }

                          return (
                            <button
                              key={key}
                              disabled={selectedAnswer !== null}
                              className={`quiz-option ${statusClass}`}
                              lang="fr"
                              onClick={() => {
                                setSelectedAnswer(key);
                                if (key === correctKey) {
                                  setQuizScore((s) => s + 1);
                                }
                                setTimeout(() => {
                                  setSelectedAnswer(null);
                                  setQuizIndex((idx) => idx + 1);
                                }, 1700);
                              }}
                            >
                              {key}. {q.options[key]}
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnswer !== null && (
                        <div
                          className={`quiz-feedback-text ${
                            selectedAnswer === correctKey
                              ? "text-correct"
                              : "text-incorrect"
                          }`}
                        >
                          {selectedAnswer === correctKey
                            ? "⭕ 正解！"
                            : "❌ 不正解..."}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}"""

quiz_new = """          {/* Comprehension Quiz */}
          {currentLevelData.quiz && currentLevelData.quiz.length > 0 && (
            <div className="quiz-section">
              <h3>🧠 {t.reading.quiz}</h3>
              {quizIndex >= currentLevelData.quiz.length ? (
                <div className="quiz-card fade-in" style={{ textAlign: "center" }}>
                  <h4
                    style={{
                      fontSize: "1.7rem",
                      marginBottom: "10px",
                      color: "var(--primary)",
                    }}
                  >
                    {t.quiz.score}: {quizScore} {t.quiz.outOf} {currentLevelData.quiz.length}
                  </h4>
                  <p
                    style={{
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      marginBottom: "20px",
                    }}
                  >
                    {quizScore === currentLevelData.quiz.length
                      ? "Excellent! 🎉"
                      : quizScore >= currentLevelData.quiz.length / 2
                        ? "Good job! 👏"
                        : "Try again! 💪"}
                  </p>
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setQuizScore(0);
                      setSelectedAnswer(null);
                    }}
                    style={{
                      background: "var(--primary)",
                      color: "white",
                      border: "none",
                      padding: "12px 24px",
                      borderRadius: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {t.quiz.finish} / {appLang === 'ja' ? 'もう一度やる' : 'Try Again'}
                  </button>
                </div>
              ) : (
                (() => {
                  const q = currentLevelData.quiz[quizIndex];
                  if (!q.choices && (q as any).options) {
                    return null;
                  }
                  
                  const qId = q.id;
                  const isQTranslated = !!translatedQuizIds[qId];

                  return (
                    <div className="quiz-card fade-in" key={quizIndex}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <p
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              margin: 0
                            }}
                          >
                            Q {quizIndex + 1} / {currentLevelData.quiz.length}
                          </p>
                          <button
                            onClick={() => setTranslatedQuizIds(prev => ({...prev, [qId]: !prev[qId]}))}
                            style={{
                                background: "none", border: "none", color: "var(--primary)",
                                fontSize: "0.75rem", cursor: "pointer", fontWeight: 700
                            }}
                          >
                            {isQTranslated ? t.reading.hideTranslation : t.reading.translateQuestion}
                          </button>
                      </div>
                      
                      <p className="quiz-question" lang="fr">
                        {q.question.fr}
                      </p>
                      {isQTranslated && (
                          <p className="quiz-question" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '-10px', marginBottom: '20px' }}>
                              {appLang === 'ja' ? q.question.ja : q.question.en}
                          </p>
                      )}
                      
                      <div>
                        {q.choices?.map((choice, cIdx) => {
                          const key = choice.id;
                          const isChosen = selectedAnswer === key;
                          const isCorrectOption = choice.isCorrect;

                          let statusClass = "";
                          if (selectedAnswer !== null) {
                            if (isCorrectOption) statusClass = "correct";
                            else if (isChosen) statusClass = "incorrect";
                          }

                          return (
                            <button
                              key={key}
                              disabled={selectedAnswer !== null}
                              className={`quiz-option ${statusClass}`}
                              onClick={() => {
                                setSelectedAnswer(key);
                                if (isCorrectOption) {
                                  setQuizScore((s) => s + 1);
                                }
                                setTimeout(() => {
                                  setSelectedAnswer(null);
                                  setQuizIndex((idx) => idx + 1);
                                }, 1700);
                              }}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                            >
                              <span lang="fr">{cIdx + 1}. {choice.text.fr}</span>
                              {isQTranslated && (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      {appLang === 'ja' ? choice.text.ja : choice.text.en}
                                  </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedAnswer !== null && (
                        <div
                          className={`quiz-feedback-text ${
                            q.choices?.find(c => c.id === selectedAnswer)?.isCorrect
                              ? "text-correct"
                              : "text-incorrect"
                          }`}
                        >
                          {q.choices?.find(c => c.id === selectedAnswer)?.isCorrect
                            ? `⭕ ${t.quiz.correct}`
                            : `❌ ${t.quiz.wrong}`}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}"""
content = content.replace(quiz_old, quiz_new)

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done step 2")
