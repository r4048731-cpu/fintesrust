package ru.fitnes.app.steps

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Мост для веб-приложения: `Steps` в JavaScript. Шаги за дни, разрешения Health Connect,
 * вечернее уведомление с итогом.
 */
@CapacitorPlugin(
    name = "Steps",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class StepsPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val contract = PermissionController.createRequestPermissionResultContract()

    private fun wanted(): Set<String> {
        val ctx = context
        return if (StepsReader.backgroundSupported(ctx)) {
            setOf(StepsReader.READ_STEPS, StepsReader.READ_IN_BACKGROUND)
        } else {
            setOf(StepsReader.READ_STEPS)
        }
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val ctx = context
        val st = StepsReader.status(ctx)
        val res = JSObject().put("health", st)
        if (st != "available") {
            call.resolve(res.put("steps", false).put("background", false))
            return
        }
        scope.launch {
            try {
                val granted = StepsReader.granted(ctx)
                val r = StepsReminder.load(ctx)
                call.resolve(
                    res.put("steps", StepsReader.READ_STEPS in granted)
                        .put("background", StepsReader.READ_IN_BACKGROUND in granted)
                        .put("backgroundSupported", StepsReader.backgroundSupported(ctx))
                        .put("reminder", r.enabled)
                        .put("hour", r.hour)
                        .put("minute", r.minute)
                        .put("goal", r.goal),
                )
            } catch (e: Exception) {
                call.reject("Health Connect не ответил: ${e.message}")
            }
        }
    }

    /** Окно Health Connect «Разрешить чтение шагов» (и чтение в фоне — для уведомления). */
    @PluginMethod
    fun requestAccess(call: PluginCall) {
        if (StepsReader.status(context) != "available") {
            call.reject("Health Connect не установлен")
            return
        }
        val intent = contract.createIntent(context, wanted())
        startActivityForResult(call, intent, "accessResult")
    }

    @ActivityCallback
    private fun accessResult(call: PluginCall, result: ActivityResult) {
        val granted = contract.parseResult(result.resultCode, result.data)
        call.resolve(
            JSObject()
                .put("steps", StepsReader.READ_STEPS in granted)
                .put("background", StepsReader.READ_IN_BACKGROUND in granted),
        )
    }

    @PluginMethod
    fun daily(call: PluginCall) {
        val days = call.getInt("days", 7) ?: 7
        scope.launch {
            try {
                val list = JSArray()
                for ((date, steps) in StepsReader.daily(context, days)) {
                    list.put(JSObject().put("date", date).put("steps", steps))
                }
                call.resolve(JSObject().put("days", list))
            } catch (e: SecurityException) {
                call.reject("Нет разрешения на чтение шагов", "NO_PERMISSION")
            } catch (e: Exception) {
                call.reject("Не удалось прочитать шаги: ${e.message}")
            }
        }
    }

    /** Включить или выключить вечернее уведомление: время и цель. */
    @PluginMethod
    fun setReminder(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) ?: false
        if (enabled && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationsResult")
            return
        }
        saveReminder(call)
    }

    @PermissionCallback
    private fun notificationsResult(call: PluginCall) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Уведомления запрещены — разрешите их в настройках телефона", "NO_NOTIFICATIONS")
            return
        }
        saveReminder(call)
    }

    private fun saveReminder(call: PluginCall) {
        val s = ReminderSettings(
            enabled = call.getBoolean("enabled", false) ?: false,
            hour = (call.getInt("hour", 21) ?: 21).coerceIn(0, 23),
            minute = (call.getInt("minute", 0) ?: 0).coerceIn(0, 59),
            goal = (call.getInt("goal", 8000) ?: 8000).coerceIn(0, 100000),
        )
        StepsReminder.save(context, s)
        call.resolve(JSObject().put("enabled", s.enabled))
    }

    /** Показать уведомление сейчас — проверить, как выглядит. */
    @PluginMethod
    fun testReminder(call: PluginCall) {
        scope.launch {
            try {
                val (title, text) = StepsReminder.message(StepsReader.today(context), StepsReminder.load(context).goal)
                StepsReminder.notify(context, title, text)
                call.resolve()
            } catch (e: Exception) {
                call.reject("Не удалось: ${e.message}")
            }
        }
    }

    /** Открыть Health Connect: установить из Google Play или его настройки. */
    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        val intent = if (StepsReader.status(context) == "available") {
            Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
        } else {
            Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"),
            )
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Не удалось открыть Health Connect")
        }
    }
}
