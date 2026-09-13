import re
import os

def fix_everything():
    # 1. Update MainActivity.java
    java_path = r'android\app\src\main\java\com\furago\app\MainActivity.java'
    java_code = """package com.furago.app;

import com.getcapacitor.BridgeActivity;
import android.view.ActionMode;

public class MainActivity extends BridgeActivity {
    @Override
    public void onActionModeStarted(ActionMode mode) {
        if (mode != null) {
            mode.finish(); // Kills the native copy/paste popup instantly
        }
        super.onActionModeStarted(mode);
    }
}
"""
    with open(java_path, 'w', encoding='utf-8') as f:
        f.write(java_code)

    # 2. Update style.css to remove user-select: none
    with open('www/style.css', 'r', encoding='utf-8') as f:
        css = f.read()
    
    css = re.sub(r'-webkit-user-select:\s*none;\s*', '', css)
    css = re.sub(r'user-select:\s*none;\s*', '', css)
    
    with open('www/style.css', 'w', encoding='utf-8') as f:
        f.write(css)

    # 3. Restore the window.getSelection check in app.js tap logic
    with open('www/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    # The current pointerup logic:
    old_pointerup = r"// Si l'utilisateur a fait défiler l'écran de plus de 10 pixels, on annule le Tap\s*if \(Math\.abs\(e\.clientX - tapStartX\) > 10 \|\| Math\.abs\(e\.clientY - tapStartY\) > 10\) \{\s*return;\s*\}"
    new_pointerup = """// Si l'utilisateur a fait défiler l'écran de plus de 10 pixels, on annule le Tap
    if (Math.abs(e.clientX - tapStartX) > 10 || Math.abs(e.clientY - tapStartY) > 10) {
        return;
    }

    // Si du texte est déjà sélectionné (long-press), on laisse selectionchange gérer
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
        return;
    }"""
    js = re.sub(old_pointerup, new_pointerup, js)
    
    with open('www/app.js', 'w', encoding='utf-8') as f:
        f.write(js)

fix_everything()
