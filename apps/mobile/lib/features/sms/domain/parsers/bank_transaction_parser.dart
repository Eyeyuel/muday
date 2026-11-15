import '../entities/bank_transaction.dart';
import '../entities/sms_message.dart';

abstract class BankTransactionParser {
  BankTransaction? parse(SmsMessageEntity message);
}
