import 'package:easy_localization/easy_localization.dart';

enum SmsTimeFilter {
  daily('Daily', 'Today'),
  weekly('Weekly', 'This Week'),
  monthly('Monthly', 'This Month'),
  all('All', 'All Time');

  const SmsTimeFilter(this.label, this.description);
  final String label;
  final String description;

  String get localizedLabel {
    switch (this) {
      case SmsTimeFilter.daily:
        return 'daily'.tr();
      case SmsTimeFilter.weekly:
        return 'weekly'.tr();
      case SmsTimeFilter.monthly:
        return 'monthly'.tr();
      case SmsTimeFilter.all:
        return 'all'.tr();
    }
  }

  DateTime? get cutoffDate {
    final now = DateTime.now();
    switch (this) {
      case SmsTimeFilter.daily:
        return DateTime(now.year, now.month, now.day);
      case SmsTimeFilter.weekly:
        final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
        return DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
      case SmsTimeFilter.monthly:
        return now.subtract(const Duration(days: 30));
      case SmsTimeFilter.all:
        // null means: no UI cutoff — let the SMS anchor date drive the floor
        return null;
    }
  }
}
