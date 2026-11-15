import '../entities/bank_transaction.dart';
import '../entities/sms_message.dart';
import '../parsers/bank_transaction_parser.dart';

class ParseBankSms {
  const ParseBankSms(this._parser);

  final BankTransactionParser _parser;

  BankTransaction? call(SmsMessageEntity message) => _parser.parse(message);
}
