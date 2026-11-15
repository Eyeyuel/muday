import '../../../../core/utils/money_utils.dart';

abstract final class AmountExtractor {
  static final _patterns = [
    RegExp(r'(?:ETB|birr|br)\s*([\d,]+(?:\.\d{1,2})?)', caseSensitive: false),
    RegExp(r'([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|birr|br)\b', caseSensitive: false),
  ];

  static double? extract(String body) {
    for (final pattern in _patterns) {
      final match = pattern.firstMatch(body);
      if (match == null) continue;
      final amount = MoneyUtils.parseAmount(match.group(1)!);
      if (amount != null && amount > 0) return amount;
    }
    return null;
  }
}
