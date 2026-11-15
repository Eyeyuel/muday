package com.example.message

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Telephony
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.PluginRegistry

class SmsReaderPlugin :
    FlutterPlugin,
    MethodChannel.MethodCallHandler,
    EventChannel.StreamHandler,
    ActivityAware,
    PluginRegistry.RequestPermissionsResultListener {
    private lateinit var methodChannel: MethodChannel
    private lateinit var eventChannel: EventChannel
    private var context: Context? = null
    private var activity: Activity? = null
    private var activityBinding: ActivityPluginBinding? = null
    private var permissionResult: MethodChannel.Result? = null
    private var eventSink: EventChannel.EventSink? = null
    private var smsReceiver: BroadcastReceiver? = null

    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        context = binding.applicationContext
        methodChannel = MethodChannel(binding.binaryMessenger, CHANNEL)
        eventChannel = EventChannel(binding.binaryMessenger, EVENT_CHANNEL)
        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "requestPermissions" -> requestPermissions(result)
            "fetchMessages" -> {
                val type = call.argument<String>("type") ?: "inbox"
                val start = call.argument<Int>("start") ?: 0
                val count = call.argument<Int>("count") ?: 100
                val sinceDate = (call.argument<Number>("sinceDate"))?.toLong()
                result.success(fetchMessages(type, start, count, sinceDate))
            }
            else -> result.notImplemented()
        }
    }

    private fun requestPermissions(result: MethodChannel.Result) {
        val currentActivity = activity
        val currentContext = context
        if (currentContext == null) {
            result.success(false)
            return
        }
        if (hasSmsPermissions(currentContext)) {
            result.success(true)
            return
        }
        if (currentActivity == null) {
            result.success(false)
            return
        }
        permissionResult = result
        ActivityCompat.requestPermissions(currentActivity, SMS_PERMISSIONS, REQUEST_CODE)
    }

    private fun hasSmsPermissions(currentContext: Context): Boolean {
        return SMS_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(currentContext, permission) ==
                PackageManager.PERMISSION_GRANTED
        }
    }

    private fun fetchMessages(type: String, start: Int, count: Int, sinceDate: Long?): List<Map<String, Any>> {
        val currentContext = context ?: return emptyList()
        val uri = when (type.lowercase()) {
            "sent" -> Telephony.Sms.Sent.CONTENT_URI
            "draft" -> Telephony.Sms.Draft.CONTENT_URI
            else -> Telephony.Sms.Inbox.CONTENT_URI
        }
        val selection = if (sinceDate != null && sinceDate > 0) "date >= ?" else null
        val selectionArgs = if (sinceDate != null && sinceDate > 0) arrayOf(sinceDate.toString()) else null
        val messages = mutableListOf<Map<String, Any>>()
        currentContext.contentResolver.query(
            uri,
            arrayOf("_id", "address", "body", "date", "type"),
            selection,
            selectionArgs,
            "date DESC LIMIT $count OFFSET $start",
        )?.use { cursor ->
            val idIdx = cursor.getColumnIndex("_id")
            val addressIdx = cursor.getColumnIndex("address")
            val bodyIdx = cursor.getColumnIndex("body")
            val dateIdx = cursor.getColumnIndex("date")
            val typeIdx = cursor.getColumnIndex("type")
            while (cursor.moveToNext()) {
                messages.add(
                    mapOf(
                        "id" to if (idIdx >= 0) cursor.getInt(idIdx) else 0,
                        "address" to if (addressIdx >= 0) {
                            cursor.getString(addressIdx) ?: ""
                        } else {
                            ""
                        },
                        "body" to if (bodyIdx >= 0) cursor.getString(bodyIdx) ?: "" else "",
                        "date" to if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L,
                        "type" to if (typeIdx >= 0) cursor.getString(typeIdx) ?: type else type,
                    ),
                )
            }
        }
        return messages
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        eventSink = events
        smsReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                Telephony.Sms.Intents.getMessagesFromIntent(intent).forEach { sms ->
                    eventSink?.success(
                        mapOf(
                            "id" to 0,
                            "address" to (sms.originatingAddress ?: ""),
                            "body" to (sms.messageBody ?: ""),
                            "date" to sms.timestampMillis,
                            "type" to "inbox",
                        ),
                    )
                }
            }
        }
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        val currentContext = context ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            currentContext.registerReceiver(smsReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            currentContext.registerReceiver(smsReceiver, filter)
        }
    }

    override fun onCancel(arguments: Any?) {
        try {
            context?.unregisterReceiver(smsReceiver)
        } catch (_: Exception) {
            // Receiver may already be unregistered.
        }
        smsReceiver = null
        eventSink = null
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ): Boolean {
        if (requestCode != REQUEST_CODE) return false
        val granted = grantResults.isNotEmpty() &&
            grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        permissionResult?.success(granted)
        permissionResult = null
        return true
    }

    override fun onAttachedToActivity(binding: ActivityPluginBinding) {
        activity = binding.activity
        activityBinding = binding
        binding.addRequestPermissionsResultListener(this)
    }

    override fun onDetachedFromActivityForConfigChanges() {
        activityBinding?.removeRequestPermissionsResultListener(this)
        activity = null
        activityBinding = null
    }

    override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
        onAttachedToActivity(binding)
    }

    override fun onDetachedFromActivity() {
        activityBinding?.removeRequestPermissionsResultListener(this)
        activity = null
        activityBinding = null
    }

    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
        methodChannel.setMethodCallHandler(null)
        eventChannel.setStreamHandler(null)
        context = null
    }

    companion object {
        const val CHANNEL = "app_sms_reader"
        const val EVENT_CHANNEL = "app_sms_observer"
        private const val REQUEST_CODE = 4101
        private val SMS_PERMISSIONS = arrayOf(
            Manifest.permission.READ_SMS,
            Manifest.permission.RECEIVE_SMS,
        )
    }
}
