import 'package:flutter_test/flutter_test.dart';
import 'package:message/features/sms/data/parsers/balance_extractor.dart';

void main() {
  group('BalanceExtractor', () {
    test('extracts balance after transaction with ETB prefix', () {
      const sms = 'Transaction successful. Your current balance is ETB 1,204.50.';
      final balance = BalanceExtractor.extract(sms);
      expect(balance, equals(1204.50));
    });

    test('extracts balance with bal: format', () {
      const sms = 'Sent ETB 300 to Abebe. Bal: 4,500.00 ETB.';
      final balance = BalanceExtractor.extract(sms);
      expect(balance, equals(4500.00));
    });

    test('extracts available balance format', () {
      const sms = 'You paid 50 Birr. Available bal is 320.00.';
      final balance = BalanceExtractor.extract(sms);
      expect(balance, equals(320.00));
    });

    test('returns null when no balance is mentioned', () {
      const sms = 'You sent ETB 200.00 to Almaz.';
      final balance = BalanceExtractor.extract(sms);
      expect(balance, isNull);
    });
  });
}
