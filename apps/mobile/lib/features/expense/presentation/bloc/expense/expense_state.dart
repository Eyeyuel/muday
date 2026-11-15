import 'package:equatable/equatable.dart';

import '../../../../../core/utils/date_utils.dart';
import '../../../domain/entities/expense.dart';

enum ExpenseStatus { initial, loading, ready, failure }

class ExpenseState extends Equatable {
  const ExpenseState({
    this.status = ExpenseStatus.initial,
    this.expenses = const [],
    this.message,
  });

  final ExpenseStatus status;
  final List<Expense> expenses;
  final String? message;

  double get monthTotal {
    return expenses
        .where((expense) => AppDateUtils.isSameMonth(expense.date))
        .fold<double>(0, (sum, expense) => sum + expense.amount);
  }

  ExpenseState copyWith({
    ExpenseStatus? status,
    List<Expense>? expenses,
    String? message,
  }) {
    return ExpenseState(
      status: status ?? this.status,
      expenses: expenses ?? this.expenses,
      message: message,
    );
  }

  @override
  List<Object?> get props => [status, expenses, message];
}
