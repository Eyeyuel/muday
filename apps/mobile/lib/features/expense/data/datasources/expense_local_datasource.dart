import 'package:hive/hive.dart';

import '../../../../core/error/exceptions.dart';
import '../models/expense_model.dart';

abstract class ExpenseLocalDataSource {
  Future<void> save(ExpenseModel expense);

  Future<List<ExpenseModel>> getAll();

  Future<bool> exists(String smsId);
}

class ExpenseLocalDataSourceImpl implements ExpenseLocalDataSource {
  ExpenseLocalDataSourceImpl(this._box);

  final Box<dynamic> _box;

  @override
  Future<void> save(ExpenseModel expense) async {
    try {
      await _box.put(expense.smsId, expense.toMap());
    } catch (error) {
      throw CacheException('Could not save expense: $error');
    }
  }

  @override
  Future<List<ExpenseModel>> getAll() async {
    try {
      final expenses = _box.values
          .whereType<Map>()
          .map(ExpenseModel.fromMap)
          .where((e) => !e.smsId.startsWith('manual_') && !e.smsId.startsWith('ai_'))
          .toList();
      expenses.sort((a, b) => b.date.compareTo(a.date));
      return expenses;
    } catch (error) {
      throw CacheException('Could not load expenses: $error');
    }
  }

  @override
  Future<bool> exists(String smsId) async => _box.containsKey(smsId);
}
