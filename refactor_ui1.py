import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Translate Audio Speed Options
audio_speed_old = """          <select
            className="audio-select"
            value={audioSpeed}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setAudioSpeed(rate);
              audioSpeedRef.current = rate;
              if (isPlayingRef.current) {
                window.speechSynthesis?.cancel();
                setTimeout(() => playNextInQueue(), 60);
              }
            }}
          >
            <option value={1}>速度 : 標準 (1x)</option>
            <option value={0.8}>速度 : 遅い (0.8x)</option>
            <option value={0.6}>速度 : とても遅い (0.6x)</option>
            <option value={0.4}>速度 : 最も遅い (0.4x)</option>
          </select>"""

audio_speed_new = """          <select
            className="audio-select"
            value={audioSpeed}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setAudioSpeed(rate);
              audioSpeedRef.current = rate;
              if (isPlayingRef.current) {
                window.speechSynthesis?.cancel();
                setTimeout(() => playNextInQueue(), 60);
              }
            }}
          >
            <option value={1}>{appLang === 'ja' ? '速度 : 標準 (1x)' : 'Speed: Normal (1x)'}</option>
            <option value={0.8}>{appLang === 'ja' ? '速度 : 遅い (0.8x)' : 'Speed: Slow (0.8x)'}</option>
            <option value={0.6}>{appLang === 'ja' ? '速度 : とても遅い (0.6x)' : 'Speed: Very Slow (0.6x)'}</option>
            <option value={0.4}>{appLang === 'ja' ? '速度 : 最も遅い (0.4x)' : 'Speed: Slowest (0.4x)'}</option>
          </select>"""
content = content.replace(audio_speed_old, audio_speed_new)

# 2. Translate Voice Selection Options
voice_select_old = """          <select
            className="audio-select"
            value={selectedVoiceIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setSelectedVoiceIdx(idx);
              if (frVoices[idx]) {
                selectedVoiceRef.current = frVoices[idx].voice;
                if (isPlayingRef.current) {
                  window.speechSynthesis?.cancel();
                  setTimeout(() => playNextInQueue(), 60);
                }
              }
            }}
          >
            {frVoices.length === 0 ? (
              <option value={0}>フランス語音声 (標準)</option>
            ) : ("""

voice_select_new = """          <select
            className="audio-select"
            value={selectedVoiceIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setSelectedVoiceIdx(idx);
              if (frVoices[idx]) {
                selectedVoiceRef.current = frVoices[idx].voice;
                if (isPlayingRef.current) {
                  window.speechSynthesis?.cancel();
                  setTimeout(() => playNextInQueue(), 60);
                }
              }
            }}
          >
            {frVoices.length === 0 ? (
              <option value={0}>{appLang === 'ja' ? 'フランス語音声 (標準)' : 'French Voice (Default)'}</option>
            ) : ("""
content = content.replace(voice_select_old, voice_select_new)

# 3. Translate Bottom Nav
bottom_nav_old = """        <nav className="bottom-nav">
          <button
            className={`nav-item ${activeView === "home" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            記事
          </button>
          <button
            className={`nav-item ${activeView === "words" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setCurrentListId(null);
              setActiveView("words");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            単語帳
          </button>
        </nav>"""

bottom_nav_new = """        <nav className="bottom-nav">
          <button
            className={`nav-item ${activeView === "home" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            {t.nav.home}
          </button>
          <button
            className={`nav-item ${activeView === "words" ? "active" : ""}`}
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setCurrentListId(null);
              setActiveView("words");
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            {t.nav.words}
          </button>
        </nav>"""
content = content.replace(bottom_nav_old, bottom_nav_new)


# 4. Rework Header to integrate Subscribe button and make it look pro
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
        <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <select 
              value={appLang} 
              onChange={(e) => setAppLang(e.target.value as AppLanguage)}
              style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  color: "var(--primary)",
                  fontWeight: 600,
                  outline: "none"
              }}
            >
                <option value="ja">日本語</option>
                <option value="en">English</option>
            </select>
            {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={() => setFilterModalType("level")}
            >
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel} ▾
            </button>
            )}
        </div>
      </header>"""

header_new = """      {/* App Header (Redesigned for Professional UI/UX) */}
      <header className="app-header" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', sticky: 'top', zIndex: 100 }}>
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
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--primary)', letterSpacing: '-0.5px' }}>Furago</h1>
        
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

# 5. Capitalize Category Badge (already inside jsx)
cat_badge_old = """              <span
                className="badge"
                style={{
                  background: "#E5E5EA",
                  color: "#636366",
                  fontSize: "0.85rem",
                }}
              >
                {typeof currentArticle.category === "string" ? currentArticle.category : currentArticle.category?.[appLang] || "General"}
              </span>"""
cat_badge_new = """              <span
                className="badge"
                style={{
                  background: "#E5E5EA",
                  color: "#636366",
                  fontSize: "0.85rem",
                  textTransform: "capitalize",
                }}
              >
                {typeof currentArticle.category === "string" ? currentArticle.category : currentArticle.category?.[appLang] || "General"}
              </span>"""
content = content.replace(cat_badge_old, cat_badge_new)

# Also the list category
list_cat_old = """                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {typeof article.category === "string" ? article.category : article.category?.[appLang] || "General"}
                        </span>"""
list_cat_new = """                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                            textTransform: "capitalize"
                          }}
                        >
                          {typeof article.category === "string" ? article.category : article.category?.[appLang] || "General"}
                        </span>"""
content = content.replace(list_cat_old, list_cat_new)


with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done refactoring UI")
