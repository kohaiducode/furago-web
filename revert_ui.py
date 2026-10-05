import sys
import re

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Revert per-paragraph translation
render_old = """      const transText = appLang === 'ja' ? p.ja : p.en;
      const isTranslated = !!showTranslation[pIdx];
      allElements.push(
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
            <p lang="fr" style={{ flex: 1, margin: 0 }}>
               {elements}
            </p>
            {transText && (
              <button
                onClick={() => setShowTranslation(prev => ({...prev, [pIdx]: !prev[pIdx]}))}
                style={{
                  background: isTranslated ? "var(--primary-light)" : "transparent",
                  color: isTranslated ? "var(--primary)" : "var(--primary)",
                  border: "1px solid var(--primary)",
                  padding: "2px 8px",
                  borderRadius: "8px",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  marginTop: "4px"
                }}
              >
                {isTranslated ? t.reading.hideTranslation : t.reading.showTranslation}
              </button>
            )}
          </div>
          {isTranslated && transText && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginTop: "8px", paddingLeft: "8px", borderLeft: "3px solid var(--border)" }}>
              {transText}
            </p>
          )}
        </div>
      );"""

render_new = """      const transText = appLang === 'ja' ? p.ja : p.en;
      allElements.push(
        <div key={p.id || pIdx} style={{ marginBottom: "1.2rem", position: "relative" }}>
          <p lang="fr" style={{ margin: 0 }}>
             {elements}
          </p>
        </div>
      );"""

content = content.replace(render_old, render_new)

# 2. Revert Header and Lead Bar
# First, find the current header
start_idx = -1
end_idx = -1
lines = content.split('\n')
for i, l in enumerate(lines):
    if "{/* App Header (Redesigned for Professional UI/UX) */}" in l:
        start_idx = i
    if start_idx != -1 and "</header>" in l:
        end_idx = i
        break

new_header = """      {/* Top Bar - Capture d'emails (Lead Generation) */}
      {showLeadBar && (
        <div className="lead-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: 'white', padding: '10px 16px', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, whiteSpace: "nowrap", fontSize: '0.95rem' }}>
            {t.nav.register}
          </span>
          <form className="lead-bar-form" onSubmit={(e) => { e.preventDefault(); handleOpenLeadModal(e); }} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="e.g. taro@furago.com"
              className="lead-bar-input"
              style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', outline: 'none', fontSize: '0.85rem' }}
            />
            <button type="submit" className="lead-bar-btn" style={{ background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '16px', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
              OK
            </button>
            <button
              type="button"
              onClick={() => setShowLeadBar(false)}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: "2px 4px",
                fontSize: "1.2rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </form>
        </div>
      )}

      {/* App Header */}
      <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', background: 'var(--surface)', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        {activeView === "reading" && (
          <button
            className="back-btn"
            onClick={() => {
              stopAudio();
              setDictOpen(false);
              setActiveView("home");
            }}
            aria-label="Back"
            style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0', color: 'var(--primary)', letterSpacing: '-0.5px', marginLeft: activeView === 'reading' ? '8px' : '0' }}>Furago</h1>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {activeView === "reading" && (
            <button
                className="header-level-btn"
                onClick={() => setFilterModalType("level")}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-main)' }}
            >
                {t.levels[globalLevel as keyof typeof t.levels] || globalLevel} ▾
            </button>
            )}
            
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: '20px', padding: '2px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setAppLang("ja")}
                style={{
                  background: appLang === 'ja' ? 'var(--primary)' : 'transparent',
                  color: appLang === 'ja' ? 'white' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '18px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
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
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🇬🇧 EN
              </button>
            </div>
        </div>
      </header>"""

if start_idx != -1 and end_idx != -1:
    content = '\n'.join(lines[:start_idx]) + '\n' + new_header + '\n' + '\n'.join(lines[end_idx+1:])

with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Done header and layout revert")
