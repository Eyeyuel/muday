import '../../../../core/constants/bank_senders.dart';
import '../../domain/entities/bank_transaction.dart';
import '../../domain/entities/sms_message.dart';
import '../../domain/parsers/bank_transaction_parser.dart';
import 'generic_bank_parser.dart';

class BankSmsParser implements BankTransactionParser {
  BankSmsParser({GenericBankParser? parser})
    : _parser = parser ?? GenericBankParser();

  final GenericBankParser _parser;

  @override
  BankTransaction? parse(SmsMessageEntity message) {
    final source =
        BankSenders.fromSender(message.sender) ??
        BankSenders.fromBody(message.body);
    if (source == null) return null;
    return _parser.parse(message, source);
  }
}
