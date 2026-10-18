package ru.fitnes.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ru.fitnes.app.run.RunTrackerPlugin;
import ru.fitnes.app.steps.StepsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // свой нативный модуль регистрируется до запуска моста
        registerPlugin(StepsPlugin.class);
        registerPlugin(RunTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
