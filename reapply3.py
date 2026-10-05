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

# Also the list category
list_cat_old = """                        <span
                          className="badge"
                          style={{
                            background: "var(--bg)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {article.category || "一般"}
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
print("Done step 3")
