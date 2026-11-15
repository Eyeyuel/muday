import '../../../../core/constants/bank_senders.dart';
import '../../domain/entities/bank_transaction.dart';
import '../../domain/entities/sms_message.dart';
import 'amount_extractor.dart';
import 'balance_extractor.dart';
import 'counterparty_extractor.dart';
import 'transaction_direction.dart';

class GenericBankParser {
  BankTransaction? parse(SmsMessageEntity message, BankSource source) {
    final isRegularTx = TransactionDirection.isTransaction(message.body);
    final balanceAfter = BalanceExtractor.extract(message.body);

    // If it's not a regular transaction AND has no balance info, skip it entirely
    if (!isRegularTx && balanceAfter == null) return null;

    // For balance-only notifications (e.g. Telebirr "Your current balance is ETB 46.00")
    // we still create a transaction record so the balance can be tracked.
    final amount = isRegularTx ? AmountExtractor.extract(message.body) : null;
    if (isRegularTx && amount == null) return null;

    final flow = isRegularTx
        ? TransactionDirection.extractFlow(message.body)
        : TransactionFlow.other;
    final counterparty =
        isRegularTx ? CounterpartyExtractor.extract(message.body) : null;

    return BankTransaction(
      smsId: message.smsId,
      amount: amount ?? 0.0,
      source: source,
      date: message.date,
      sender: message.sender,
      rawBody: message.body,
      flow: flow,
      counterpartyName: counterparty?.name,
      counterpartyAccount: counterparty?.account,
      balanceAfter: balanceAfter,
    );
  }
}
