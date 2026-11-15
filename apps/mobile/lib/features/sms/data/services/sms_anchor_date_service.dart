import 'package:hive_flutter/hive_flutter.dart';

/// Persists the very first SMS scan anchor date, scoped per user.
///
/// On the first scan or login, we calculate: `userRegistrationDate - 30 days`.
/// That date is stored permanently in Hive and NEVER changes afterwards.
/// When the user logs out and logs in again, their fixed anchor date is retained.
class SmsAnchorDateService {
  SmsAnchorDateService(this._box);

  final Box<dynamic> _box;

  String _getKey([String? userId]) =>
      (userId != null && userId.isNotEmpty)
          ? 'sms_scan_anchor_date_ms_$userId'
          : 'sms_scan_anchor_date_ms';

  /// Returns the stored anchor date for the user, or null if not yet initialized.
  DateTime? getAnchorDate({String? userId}) {
    final key = _getKey(userId);
    final ms = _box.get(key) as int? ?? _box.get('sms_scan_anchor_date_ms') as int?;
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }

  /// Initializes the anchor date if not set or updates it with the true registration date.
  /// The anchor is set to 30 days before [registrationDate] (or today if not available).
  DateTime initAnchor({String? userId, DateTime? registrationDate}) {
    final key = _getKey(userId);
    final existingMs = _box.get(key) as int?;

    if (registrationDate != null) {
      final anchor = registrationDate.subtract(const Duration(days: 30));
      final normalized = DateTime(anchor.year, anchor.month, anchor.day);

      _box.put(key, normalized.millisecondsSinceEpoch);
      _box.put('sms_scan_anchor_date_ms', normalized.millisecondsSinceEpoch);
      return normalized;
    }

    if (existingMs != null) {
      return DateTime.fromMillisecondsSinceEpoch(existingMs);
    }

    final globalMs = _box.get('sms_scan_anchor_date_ms') as int?;
    if (globalMs != null) {
      _box.put(key, globalMs);
      return DateTime.fromMillisecondsSinceEpoch(globalMs);
    }

    final base = DateTime.now();
    final anchor = base.subtract(const Duration(days: 30));
    final normalized = DateTime(anchor.year, anchor.month, anchor.day);
    _box.put(key, normalized.millisecondsSinceEpoch);
    _box.put('sms_scan_anchor_date_ms', normalized.millisecondsSinceEpoch);
    return normalized;
  }
}
