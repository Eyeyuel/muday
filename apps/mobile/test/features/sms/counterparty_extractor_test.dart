import 'package:flutter_test/flutter_test.dart';
import 'package:message/features/sms/data/parsers/counterparty_extractor.dart';

void main() {
  group('CounterpartyExtractor', () {
    test('extracts counterparty name and phone number', () {
      const sms = 'You have sent ETB 250.00 to Abebe Kebede (0911234567).';
      final result = CounterpartyExtractor.extract(sms);
      expect(result.name, equals('Abebe Kebede'));
      expect(result.account, equals('0911234567'));
    });

    test('extracts counterparty name and account number', () {
      const sms = 'Transferred ETB 1500 to Almaz Ayele acc 1000123456789.';
      final result = CounterpartyExtractor.extract(sms);
      expect(result.name, equals('Almaz Ayele'));
    });

    test('extracts received from counterparty', () {
      const sms = 'You have received ETB 500.00 from Chala Gemeda (0922113344).';
      final result = CounterpartyExtractor.extract(sms);
      expect(result.name, equals('Chala Gemeda'));
      expect(result.account, equals('0922113344'));
    });

    test('returns null when no counterparty present', () {
      const sms = 'Your account balance is ETB 450.00.';
      final result = CounterpartyExtractor.extract(sms);
      expect(result.name, isNull);
    });
  });
}
