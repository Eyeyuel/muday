import '../../../../core/constants/bank_senders.dart';
import '../../domain/entities/expense.dart';

class ExpenseModel extends Expense {
  const ExpenseModel({
    required super.smsId,
    required super.amount,
    required super.category,
    super.source,
    required super.date,
    super.note,
  });

  factory ExpenseModel.fromEntity(Expense expense) {
    return ExpenseModel(
      smsId: expense.smsId,
      amount: expense.amount,
      category: expense.category,
      source: expense.source,
      date: expense.date,
      note: expense.note,
    );
  }

  factory ExpenseModel.fromMap(Map<dynamic, dynamic> map) {
    BankSource? foundSource;
    final sourceStr = map['source'] as String?;
    if (sourceStr != null && sourceStr.isNotEmpty) {
      for (final b in BankSource.values) {
        if (b.name == sourceStr) {
          foundSource = b;
          break;
        }
      }
    }

    return ExpenseModel(
      smsId: map['smsId'] as String,
      amount: (map['amount'] as num).toDouble(),
      category: map['category'] as String,
      source: foundSource,
      date: DateTime.parse(map['date'] as String),
      note: map['note'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'smsId': smsId,
      'amount': amount,
      'category': category,
      'source': source?.name,
      'date': date.toIso8601String(),
      'note': note,
    };
  }
}
