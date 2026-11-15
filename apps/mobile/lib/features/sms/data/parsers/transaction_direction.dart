import '../../domain/entities/bank_transaction.dart';

abstract final class TransactionDirection {
  static final _credit = RegExp(
    r'\b(received|credited|deposited|has been credited|you have received|incoming|received from)\b',
    caseSensitive: false,
  );

  static final _debit = RegExp(
    r'\b(transferred|transfer|sent|paid|payment|debited|withdrawn|withdrawal|purchase|purchased|bought|airtime)\b',
    caseSensitive: false,
  );

  static final _sentKeywords = RegExp(
    r'\b(sent to|transferred to|paid to|transfer to)\b',
    caseSensitive: false,
  );

  static final _receivedKeywords = RegExp(
    r'\b(received|received from|credited|deposited|you have received|incoming)\b',
    caseSensitive: false,
  );

  static final _nonTransferKeywords = RegExp(
    r'\b(airtime|bill|utility|fee|tax|withdrawn|withdrawal|purchase|purchased|bought)\b',
    caseSensitive: false,
  );

  static bool isExpense(String body) {
    if (_credit.hasMatch(body) && !_debit.hasMatch(body)) return false;
    if (_debit.hasMatch(body)) return true;
    return false;
  }

  static bool isTransaction(String body) {
    return _credit.hasMatch(body) || _debit.hasMatch(body);
  }

  static TransactionFlow extractFlow(String body) {
    if (_receivedKeywords.hasMatch(body) && !_sentKeywords.hasMatch(body)) {
      return TransactionFlow.received;
    }
    if (_sentKeywords.hasMatch(body)) {
      return TransactionFlow.sent;
    }
    if (_nonTransferKeywords.hasMatch(body)) {
      return TransactionFlow.other;
    }
    if (_credit.hasMatch(body)) {
      return TransactionFlow.received;
    }
    if (_debit.hasMatch(body)) {
      return TransactionFlow.sent;
    }
    return TransactionFlow.other;
  }
}
