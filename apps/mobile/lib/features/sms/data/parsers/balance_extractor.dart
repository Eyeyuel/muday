import '../../../../core/utils/money_utils.dart';

abstract final class BalanceExtractor {
  static final _patterns = [
    // Telebirr: "Your current E-Money Account balance is ETB 619.00" or "Your current balance is ETB 46.00"
    RegExp(
      r'(?:your\s+)?(?:current\s+)?(?:e-money\s+)?(?:account\s+)?bal(?:ance)?\s*(?:is|:|\.|=)?\s*(?:ETB|birr|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)',
      caseSensitive: false,
      multiLine: true,
    ),
    // "Available / Remaining / New balance is ETB 10,500.00"
    RegExp(
      r'(?:available|remaining|new|avail)\s+(?:account\s+)?bal(?:ance)?\s*(?:is|:|\.|=)?\s*(?:ETB|birr|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)',
      caseSensitive: false,
      multiLine: true,
    ),
    // "Balance: ETB 10,500.00" or "Bal ETB 10,500.00"
    RegExp(
      r'\bbal(?:ance)?\s*[:=\.]\s*(?:ETB|birr|br\.?)?\s*([\d,]+(?:\.\d{1,2})?)',
      caseSensitive: false,
      multiLine: true,
    ),
    // "ETB 619.00 is your current balance"
    RegExp(
      r'(?:ETB|birr|br\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:is|as)?\s*(?:your\s+)?(?:current|new|available)?\s*(?:e-money\s+)?(?:account\s+)?bal(?:ance)?',
      caseSensitive: false,
      multiLine: true,
    ),
    // Amharic: "የሂሳብዎ ቀሪ / ቀሪ ሂሳብዎ / ባላንስዎ ETB 619.00"
    RegExp(
      r'(?:ቀሪ\s*ሂሳብ(?:ዎ)?|የ(?:ሂሳብዎ\s*)?ቀሪ|ቀሪ\s*ገንዘብ(?:ዎ)?|ባላንስ(?:ዎ)?)\s*(?:ነው|፡|:|\.)?\s*(?:ETB|ብር|birr)?\s*([\d,]+(?:\.\d{1,2})?)',
      caseSensitive: false,
      multiLine: true,
    ),
    RegExp(
      r'(?:ETB|ብር|birr)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:ቀሪ\s*ሂሳብ(?:ዎ)?|ባላንስ(?:ዎ)?)',
      caseSensitive: false,
      multiLine: true,
    ),
  ];

  static double? extract(String body) {
    for (final pattern in _patterns) {
      final match = pattern.firstMatch(body);
      if (match == null) continue;
      final rawAmount = match.group(1);
      if (rawAmount == null || rawAmount.isEmpty) continue;
      final amount = MoneyUtils.parseAmount(rawAmount);
      if (amount != null && amount >= 0) return amount;
    }
    return null;
  }
}
