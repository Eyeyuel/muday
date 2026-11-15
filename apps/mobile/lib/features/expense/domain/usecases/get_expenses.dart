import '../entities/expense.dart';
import '../repositories/expense_repository.dart';

class GetExpenses {
  const GetExpenses(this._repository);

  final ExpenseRepository _repository;

  Future<List<Expense>> call({DateTime? since}) => _repository.getAll(since: since);
}
