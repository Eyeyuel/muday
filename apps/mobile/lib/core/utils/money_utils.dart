import 'package:intl/intl.dart';

abstract final class MoneyUtils {
  static final _format = NumberFormat.currency(
    symbol: 'ETB ',
    decimalDigits: 2,
  );

  static String formatBirr(double amount) => _format.format(amount);

  static double? parseAmount(String raw) {
    final cleaned = raw.replaceAll(',', '').trim();
    return double.tryParse(cleaned);
  }
}
