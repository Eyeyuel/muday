import 'package:equatable/equatable.dart';

import '../../../domain/entities/expense.dart';

abstract class ExpenseEvent extends Equatable {
  const ExpenseEvent();

  @override
  List<Object?> get props => [];
}

class ExpenseStarted extends ExpenseEvent {
  const ExpenseStarted({this.since});

  final DateTime? since;

  @override
  List<Object?> get props => [since];
}

class ExpenseSaved extends ExpenseEvent {
  const ExpenseSaved(this.expense);

  final Expense expense;

  @override
  List<Object?> get props => [expense];
}
