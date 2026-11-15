import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../domain/usecases/get_expenses.dart';
import '../../../domain/usecases/save_expense.dart';
import 'expense_event.dart';
import 'expense_state.dart';

class ExpenseBloc extends Bloc<ExpenseEvent, ExpenseState> {
  ExpenseBloc(this._getExpenses, this._saveExpense)
    : super(const ExpenseState()) {
    on<ExpenseStarted>(_onStarted);
    on<ExpenseSaved>(_onSaved);
  }

  final GetExpenses _getExpenses;
  final SaveExpense _saveExpense;

  Future<void> _onStarted(
    ExpenseStarted event,
    Emitter<ExpenseState> emit,
  ) async {
    emit(state.copyWith(status: ExpenseStatus.loading));
    try {
      final expenses = await _getExpenses(since: event.since);
      emit(ExpenseState(status: ExpenseStatus.ready, expenses: expenses));
    } catch (error) {
      emit(
        state.copyWith(
          status: ExpenseStatus.failure,
          message: error.toString(),
        ),
      );
    }
  }

  Future<void> _onSaved(
    ExpenseSaved event,
    Emitter<ExpenseState> emit,
  ) async {
    try {
      await _saveExpense(event.expense);
      final expenses = await _getExpenses();
      emit(ExpenseState(status: ExpenseStatus.ready, expenses: expenses));
    } catch (error) {
      emit(
        state.copyWith(
          status: ExpenseStatus.failure,
          message: error.toString(),
        ),
      );
    }
  }
}
