package com.furago.app;

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
