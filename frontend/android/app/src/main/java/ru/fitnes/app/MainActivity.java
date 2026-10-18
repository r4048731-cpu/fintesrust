package ru.fitnes.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ru.fitnes.app.run.RunTrackerPlugin;
import ru.fitnes.app.share.ShareImagePlugin;
import ru.fitnes.app.steps.StepsPlugin;
import ru.fitnes.app.workout.WorkoutAlertsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // свой нативный модуль регистрируется до запуска моста
        registerPlugin(StepsPlugin.class);
        registerPlugin(RunTrackerPlugin.class);
        registerPlugin(WorkoutAlertsPlugin.class);
        registerPlugin(ShareImagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
