import 'package:equatable/equatable.dart';

import '../../../../core/constants/bank_senders.dart';

class Expense extends Equatable {
  const Expense({
    required this.smsId,
    required this.amount,
    required this.category,
    this.source,
    required this.date,
    this.note,
  });

  final String smsId;
  final double amount;
  final String category;
  final BankSource? source;
  final DateTime date;
  final String? note;

  @override
  List<Object?> get props => [smsId, amount, category, source, date, note];
}
