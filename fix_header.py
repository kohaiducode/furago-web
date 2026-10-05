import sys

with open("src/components/FuragoApp.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, l in enumerate(lines):
    if "{/* Top Bar" in l:
        start_idx = i
    if start_idx != -1 and "</header>" in l:
        end_idx = i
        break

new_header = """      {/* App Header (Redesigned for Professional UI/UX) */}
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
      </header>\n"""

if start_idx != -1 and end_idx != -1:
    new_lines = lines[:start_idx] + [new_header] + lines[end_idx+1:]
    with open("src/components/FuragoApp.tsx", "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Replaced header successfully")
else:
    print("Header not found")
