import '../entities/expense.dart';

abstract class ExpenseRepository {
  Future<void> save(Expense expense);

  Future<List<Expense>> getAll({DateTime? since});

  Future<bool> exists(String smsId);
}
