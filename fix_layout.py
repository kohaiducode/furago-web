import sys
import re

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Redesign Language Selector in Header
header_old = """            <div style={{ position: 'relative' }}>
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
            </div>"""

header_new = """            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '20px', padding: '2px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setAppLang("ja")}
                style={{
                  background: appLang === 'ja' ? 'var(--primary)' : 'transparent',
                  color: appLang === 'ja' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🇯🇵 JP
              </button>
              <button 
                onClick={() => setAppLang("en")}
                style={{
                  background: appLang === 'en' ? 'var(--primary)' : 'transparent',
                  color: appLang === 'en' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🇬🇧 EN
              </button>
            </div>"""

content = content.replace(header_old, header_new)

# 2. Move translation toggle to top right of article box
reading_header_old = """          <div className="article-header">
            <h2 lang="fr">{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>
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
                {typeof currentArticle.category === "string" ? currentArticle.category : (currentArticle.category as any)?.[appLang] || "General"}
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
                        color: showTranslation ? "var(--text-main)" : "var(--primary)",
                        border: "1px solid var(--primary)",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        cursor: "pointer"
                    }}
                >
                    {showTranslation ? t.reading.hideTranslation : t.reading.showTranslation}
                </button>
            </div>
          </div>"""

reading_header_new = """          <div className="article-header" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <h2 lang="fr" style={{ margin: 0, flex: 1 }}>{typeof currentLevelData.title === "string" ? currentLevelData.title : (currentLevelData.title as any)?.fr}</h2>
                <button
                    onClick={() => setShowTranslation(!showTranslation)}
                    style={{
                        background: showTranslation ? "var(--primary-light)" : "transparent",
                        color: showTranslation ? "var(--primary)" : "var(--primary)",
                        border: "1px solid var(--primary)",
                        padding: "6px 12px",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0
                    }}
                >
                    {showTranslation ? t.reading.hideTranslation : t.reading.showTranslation}
                </button>
            </div>
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
                {typeof currentArticle.category === "string" ? currentArticle.category : (currentArticle.category as any)?.[appLang] || "General"}
              </span>
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: "10px"
              }}
            >
              💡 {appLang === 'ja' ? '単語をタップすると辞書が開きます' : 'Tap a word to open the dictionary'}
            </p>
          </div>"""

content = content.replace(reading_header_old, reading_header_new)

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done header and article layout")
