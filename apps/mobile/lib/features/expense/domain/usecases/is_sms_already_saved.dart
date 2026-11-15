import '../repositories/expense_repository.dart';

class IsSmsAlreadySaved {
  const IsSmsAlreadySaved(this._repository);

  final ExpenseRepository _repository;

  Future<bool> call(String smsId) => _repository.exists(smsId);
}
