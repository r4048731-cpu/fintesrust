package ru.fitnes.app.water

import android.Manifest
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/** Мост для веб-приложения: `Water` в JavaScript — напоминание пить воду. */
@CapacitorPlugin(
    name = "Water",
    permissions = [Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])],
)
class WaterPlugin : Plugin() {
    @PluginMethod
    fun getReminder(call: PluginCall) {
        val s = WaterReminder.load(context)
        call.resolve(
            JSObject()
                .put("enabled", s.enabled)
                .put("from", s.from)
                .put("to", s.to)
                .put("every", s.every),
        )
    }

    /** Включить или выключить: часы начала и конца и как часто, в часах. */
    @PluginMethod
    fun setReminder(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) ?: false
        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "afterPermission")
            return
        }
        save(call)
    }

    @PermissionCallback
    private fun afterPermission(call: PluginCall) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("Уведомления запрещены — разрешите их в настройках телефона", "NO_NOTIFICATIONS")
            return
        }
        save(call)
    }

    private fun save(call: PluginCall) {
        val from = (call.getInt("from", 9) ?: 9).coerceIn(0, 22)
        val to = (call.getInt("to", 21) ?: 21).coerceIn(from + 1, 23)
        WaterReminder.save(
            context,
            enabled = call.getBoolean("enabled", false) ?: false,
            from = from,
            to = to,
            every = (call.getInt("every", 2) ?: 2).coerceIn(1, 6),
        )
        call.resolve()
    }

    /** Сколько выпито за день и норма — для текста и чтобы не напоминать зря. */
    @PluginMethod
    fun setInfo(call: PluginCall) {
        WaterReminder.saveInfo(
            context,
            call.getString("date") ?: "",
            call.getInt("ml", 0) ?: 0,
            call.getInt("goal", 2000) ?: 2000,
        )
        call.resolve()
    }

    /** Показать напоминание сейчас — проверить, как выглядит. */
    @PluginMethod
    fun testReminder(call: PluginCall) {
        WaterReminder.notify(context, WaterReminder.load(context))
        call.resolve()
    }
}
