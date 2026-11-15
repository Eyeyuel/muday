abstract final class AppDateUtils {
  static bool isSameMonth(DateTime date, [DateTime? now]) {
    final current = now ?? DateTime.now();
    return date.year == current.year && date.month == current.month;
  }

  static DateTime fromSmsMillis(int millis) {
    if (millis <= 0) return DateTime.now();
    return DateTime.fromMillisecondsSinceEpoch(millis);
  }
}
