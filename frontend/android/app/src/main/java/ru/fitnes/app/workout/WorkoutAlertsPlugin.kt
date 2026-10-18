package ru.fitnes.app.workout

import android.Manifest
import android.os.Build
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Мост для веб-приложения: `WorkoutAlerts` в JavaScript. Вибрация (в WebView нет
 * navigator.vibrate) и будильник конца отдыха, который сработает при погасшем экране.
 */
@CapacitorPlugin(
    name = "WorkoutAlerts",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class WorkoutAlertsPlugin : Plugin() {
    @PluginMethod
    fun vibrate(call: PluginCall) {
        val arr = call.getArray("pattern")
        val pattern = (0 until (arr?.length() ?: 0)).map { arr!!.getLong(it) }.toLongArray()
        if (pattern.isNotEmpty()) RestAlarm.vibrate(context, pattern)
        call.resolve()
    }

    /** Будильник на `at` (мс эпохи); первый раз спросит разрешение на уведомления. */
    @PluginMethod
    fun scheduleRest(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "afterPermission")
            return
        }
        schedule(call)
    }

    @PermissionCallback
    private fun afterPermission(call: PluginCall) {
        // и без разрешения будильник нужен: телефон хотя бы провибрирует
        schedule(call)
    }

    private fun schedule(call: PluginCall) {
        val at = call.getLong("at")
        if (at == null) {
            call.reject("Нет времени конца отдыха")
            return
        }
        RestAlarm.schedule(context, at, call.getString("text") ?: "")
        call.resolve()
    }

    @PluginMethod
    fun cancelRest(call: PluginCall) {
        RestAlarm.cancel(context)
        call.resolve()
    }
}
