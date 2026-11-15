import 'package:flutter_test/flutter_test.dart';
import 'package:message/core/utils/money_utils.dart';
import 'package:message/features/sms/data/parsers/bank_sms_parser.dart';
import 'package:message/features/sms/domain/entities/bank_transaction.dart';
import 'package:message/features/sms/domain/entities/sms_message.dart';

void main() {
  test('formats birr amounts', () {
    expect(MoneyUtils.formatBirr(100), contains('100'));
  });

  test('parses a Telebirr debit SMS', () {
    final parser = BankSmsParser();
    final transaction = parser.parse(
      SmsMessageEntity(
        smsId: '1',
        sender: 'Telebirr',
        body: 'You have sent ETB 100.00 to 0911234567.',
        date: DateTime(2026, 8, 15),
      ),
    );

    expect(transaction, isNotNull);
    expect(transaction!.amount, 100);
    expect(transaction.source.label, 'Telebirr');
  });

  test('parses a CBE credit SMS', () {
    final parser = BankSmsParser();
    final transaction = parser.parse(
      SmsMessageEntity(
        smsId: '2',
        sender: 'CBE',
        body: 'You have received ETB 500.00 from 0911000000.',
        date: DateTime(2026, 8, 15),
      ),
    );

    expect(transaction, isNotNull);
    expect(transaction!.amount, 500);
    expect(transaction.flow, TransactionFlow.received);
  });

  test('parses a Telebirr incoming credit SMS with counterparty and balance', () {
    final parser = BankSmsParser();
    final transaction = parser.parse(
      SmsMessageEntity(
        smsId: '4',
        sender: '127',
        body: 'Dear Mekdim You have received ETB 480.00 from Abraham Shiferaw(2519****3506) on 17/08/2026 13:34:09. Your transaction number is DHH1UT8EH3. Your current E-Money Account balance is ETB 867.00. Thank you for using telebirr Ethio telecom',
        date: DateTime(2026, 8, 17),
      ),
    );

    expect(transaction, isNotNull);
    expect(transaction!.amount, 480.00);
    expect(transaction.flow, TransactionFlow.received);
    expect(transaction.counterpartyName, 'Abraham Shiferaw');
    expect(transaction.counterpartyAccount, '2519****3506');
    expect(transaction.balanceAfter, 867.00);
  });

  test('parses an M-Pesa debit SMS', () {
    final parser = BankSmsParser();
    final transaction = parser.parse(
      SmsMessageEntity(
        smsId: '3',
        sender: 'MPESA',
        body: 'Confirmed. You have sent ETB 250.00 to 0911223344.',
        date: DateTime(2026, 8, 15),
      ),
    );

    expect(transaction, isNotNull);
    expect(transaction!.amount, 250);
    expect(transaction.source.label, 'M-Pesa');
  });
}
