package ru.fitnes.app.run

import android.Manifest
import android.location.LocationManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

/**
 * Мост для веб-приложения: `RunTracker` в JavaScript. Запись маршрута бега службой
 * переднего плана — точки GPS идут и при выключенном экране.
 */
@CapacitorPlugin(
    name = "RunTracker",
    permissions = [
        Permission(
            alias = "location",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
        ),
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS]),
    ],
)
class RunTrackerPlugin : Plugin() {
    /** Начать запись (если уже идёт — ничего не меняется). Спрашивает доступ к геолокации. */
    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            // уведомление о записи — заодно; без него служба тоже работает, только значок не виден
            requestPermissionForAliases(arrayOf("location", "notifications"), call, "permissionsResult")
            return
        }
        startService(call)
    }

    @PermissionCallback
    private fun permissionsResult(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Нет доступа к геолокации", "NO_LOCATION")
            return
        }
        startService(call)
    }

    private fun startService(call: PluginCall) {
        try {
            RunLocationService.start(context, call.getString("title") ?: "Идёт запись маршрута")
            call.resolve()
        } catch (e: Exception) {
            call.reject("Не удалось начать запись маршрута: ${e.message}")
        }
    }

    /** Накопленные точки и включён ли GPS на телефоне. */
    @PluginMethod
    fun drain(call: PluginCall) {
        val lm = context.getSystemService(LocationManager::class.java)
        call.resolve(
            fixes()
                .put("gpsOn", lm.isProviderEnabled(LocationManager.GPS_PROVIDER))
                .put("running", RunLocationService.running),
        )
    }

    /** Остановить запись; возвращает точки, которые ещё не забрали. */
    @PluginMethod
    fun stop(call: PluginCall) {
        RunLocationService.stop(context)
        call.resolve(fixes())
    }

    private fun fixes(): JSObject {
        val list = JSArray()
        for (f in RunLocationService.drain()) {
            list.put(
                JSObject()
                    .put("lat", f.lat)
                    .put("lon", f.lon)
                    .put("accuracy", f.accuracy.toDouble())
                    .put("alt", f.alt ?: JSONObject.NULL)
                    .put("t", f.t),
            )
        }
        return JSObject().put("fixes", list)
    }
}
