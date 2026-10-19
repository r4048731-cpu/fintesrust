package ru.fitnes.app.workout

import android.Manifest
import android.os.Build
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Мост для веб-приложения: `WorkoutAlerts` в JavaScript. Вибрация (в WebView нет
 * navigator.vibrate), будильник конца отдыха, который сработает при погасшем экране,
 * и напоминание о тренировке в выбранные дни недели.
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

    /** Настройки напоминания о тренировке. */
    @PluginMethod
    fun getTrainingReminder(call: PluginCall) {
        val s = TrainingReminder.load(context)
        call.resolve(
            JSObject()
                .put("enabled", s.enabled)
                .put("hour", s.hour)
                .put("minute", s.minute)
                .put("days", JSArray(s.days.sorted())),
        )
    }

    /** Включить или выключить напоминание: дни недели (1 — пн … 7 — вс) и время. */
    @PluginMethod
    fun setTrainingReminder(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) ?: false
        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "afterReminderPermission")
            return
        }
        saveReminder(call)
    }

    @PermissionCallback
    private fun afterReminderPermission(call: PluginCall) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Уведомления запрещены — разрешите их в настройках телефона", "NO_NOTIFICATIONS")
            return
        }
        saveReminder(call)
    }

    private fun saveReminder(call: PluginCall) {
        val arr = call.getArray("days")
        val days = (0 until (arr?.length() ?: 0)).map { arr!!.getInt(it) }.filter { it in 1..7 }.toSet()
        TrainingReminder.save(
            context,
            enabled = call.getBoolean("enabled", false) ?: false,
            hour = (call.getInt("hour", 19) ?: 19).coerceIn(0, 23),
            minute = (call.getInt("minute", 0) ?: 0).coerceIn(0, 59),
            days = days,
        )
        call.resolve()
    }

    /** Следующая тренировка программы и дата последней — для текста и чтобы не напоминать зря. */
    @PluginMethod
    fun setTrainingInfo(call: PluginCall) {
        TrainingReminder.saveInfo(context, call.getString("next") ?: "", call.getString("doneDate") ?: "")
        call.resolve()
    }

    /** Показать напоминание сейчас — проверить, как выглядит. */
    @PluginMethod
    fun testTrainingReminder(call: PluginCall) {
        TrainingReminder.notify(context, TrainingReminder.load(context).next)
        call.resolve()
    }
}
