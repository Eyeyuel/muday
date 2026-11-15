import 'package:equatable/equatable.dart';

import '../../../../core/constants/bank_senders.dart';

enum TransactionFlow { sent, received, other }

class BankTransaction extends Equatable {
  const BankTransaction({
    required this.smsId,
    required this.amount,
    required this.source,
    required this.date,
    required this.sender,
    required this.rawBody,
    this.flow = TransactionFlow.sent,
    this.counterpartyName,
    this.counterpartyAccount,
    this.balanceAfter,
  });

  final String smsId;
  final double amount;
  final BankSource source;
  final DateTime date;
  final String sender;
  final String rawBody;
  final TransactionFlow flow;
  final String? counterpartyName;
  final String? counterpartyAccount;
  final double? balanceAfter;

  @override
  List<Object?> get props => [
    smsId,
    amount,
    source,
    date,
    sender,
    rawBody,
    flow,
    counterpartyName,
    counterpartyAccount,
    balanceAfter,
  ];
}
