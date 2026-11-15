import 'package:flutter_test/flutter_test.dart';
import 'package:message/features/sms/data/parsers/transaction_direction.dart';
import 'package:message/features/sms/domain/entities/bank_transaction.dart';

void main() {
  group('TransactionDirection', () {
    test('classifies sent flow', () {
      const sms = 'You have sent ETB 250.00 to Abebe.';
      expect(TransactionDirection.extractFlow(sms), equals(TransactionFlow.sent));
    });

    test('classifies received flow', () {
      const sms = 'You have received ETB 500.00 from Chala.';
      expect(TransactionDirection.extractFlow(sms), equals(TransactionFlow.received));
    });

    test('classifies other flow (e.g. airtime / bill)', () {
      const sms = 'Airtime purchase of ETB 50.00 successful.';
      expect(TransactionDirection.extractFlow(sms), equals(TransactionFlow.other));
    });
  });
}
