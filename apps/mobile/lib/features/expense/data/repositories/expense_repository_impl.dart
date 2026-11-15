import '../../../../core/constants/bank_senders.dart';
import '../../../../core/constants/categories.dart';
import '../../../auth/data/datasources/auth_datasource.dart';
import '../../domain/entities/expense.dart';
import '../../domain/repositories/expense_repository.dart';
import '../services/offline_sync_service.dart';

class ExpenseRepositoryImpl implements ExpenseRepository {
  ExpenseRepositoryImpl(this._authDataSource, this._offlineSyncService);

  final AuthDataSource _authDataSource;
  final OfflineSyncService _offlineSyncService;

  // In-memory cache of server transactions for instant fast rendering
  List<Expense> _cachedExpenses = [];

  String _getCategoryKeyword(String category) {
    switch (category.toUpperCase()) {
      case ExpenseCategories.foodGroceries:
        return 'food';
      case ExpenseCategories.transport:
        return 'transport';
      case ExpenseCategories.utilities:
        return 'utilities';
      case ExpenseCategories.airtimeInternet:
        return 'airtime';
      case ExpenseCategories.shoppingHousehold:
        return 'shopping';
      case ExpenseCategories.housingRent:
        return 'rent';
      case ExpenseCategories.health:
        return 'health';
      case ExpenseCategories.education:
        return 'education';
      case ExpenseCategories.entertainment:
        return 'entertainment';
      case ExpenseCategories.clothingPersonalCare:
        return 'clothing';
      case ExpenseCategories.churchCharityGifts:
        return 'charity';
      case ExpenseCategories.travel:
        return 'travel';
      case ExpenseCategories.feesTaxes:
        return 'tax';
      case ExpenseCategories.salary:
        return 'salary';
      case ExpenseCategories.business:
        return 'business';
      case ExpenseCategories.freelance:
        return 'freelance';
      case ExpenseCategories.remittance:
        return 'remittance';
      default:
        return ExpenseCategories.getLabel(category).toLowerCase();
    }
  }

  @override
  Future<void> save(Expense expense) async {
    final cat = expense.category.toUpperCase();
    final isUncategorized = cat == 'UNCATEGORIZED' ||
        cat == ExpenseCategories.uncategorized.toUpperCase() ||
        cat.isEmpty;

    if (isUncategorized) return;

    final isBankSms = !expense.smsId.startsWith('manual_') &&
        !expense.smsId.startsWith('ai_');

    // Optimistically update memory cache immediately
    _cachedExpenses.removeWhere((e) => e.smsId == expense.smsId);
    _cachedExpenses.insert(0, expense);

    final uuidRegex = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
    final isUuid = uuidRegex.hasMatch(expense.smsId);

    if (isUuid) {
      try {
        await _authDataSource.updateTransaction(
          expense.smsId,
          category: _getCategoryKeyword(expense.category),
          type: 'expense',
          note: expense.note,
        );
      } catch (_) {
        await _authDataSource.saveBankSmsTransaction(
          amount: expense.amount,
          type: 'EXPENSE',
          category: expense.category,
          bankSource: expense.source?.name,
          occurredAt: expense.date,
          note: expense.note,
          smsId: expense.smsId,
        );
      }
    } else if (isBankSms) {
      try {
        await _authDataSource.saveBankSmsTransaction(
          amount: expense.amount,
          type: 'EXPENSE',
          category: expense.category,
          bankSource: expense.source?.name,
          occurredAt: expense.date,
          note: expense.note,
          smsId: expense.smsId,
        );
      } catch (_) {
        // Enqueue into offline sync outbox if network/server is unavailable
        await _offlineSyncService.enqueueBankSms(
          amount: expense.amount,
          type: 'EXPENSE',
          category: expense.category,
          bankSource: expense.source?.name,
          occurredAt: expense.date,
          note: expense.note,
          smsId: expense.smsId,
        );
      }
    } else {
      final categoryWord = _getCategoryKeyword(expense.category);
      final amt = expense.amount % 1 == 0
          ? expense.amount.toInt().toString()
          : expense.amount.toStringAsFixed(2);

      String textCommand = '$amt birr for $categoryWord';
      if (expense.note != null && expense.note!.trim().isNotEmpty) {
        textCommand += ' ${expense.note!.trim()}';
      }

      try {
        await _authDataSource.postTextTransaction(textCommand);
      } catch (_) {
        // Enqueue into offline sync outbox if network/server is unavailable
        await _offlineSyncService.enqueueText(textCommand);
      }
    }
  }

  @override
  Future<List<Expense>> getAll({DateTime? since}) async {
    // 1. Flush offline outbox in background if connected
    _offlineSyncService.flushQueue().ignore();

    // 2. Fetch live transaction history from backend database with pagination
    try {
      const pageSize = 50;
      int offset = 0;
      final allHistory = <Map<String, dynamic>>[];

      while (true) {
        final page = await _authDataSource.getTransactionHistory(
          limit: pageSize,
          offset: offset,
          since: since,
        );
        if (page.isEmpty) break;
        allHistory.addAll(page);
        if (page.length < pageSize) break;
        offset += page.length;
      }

      if (allHistory.isNotEmpty) {
        final items = <Expense>[];

        for (final item in allHistory) {
          final id = item['id'] as String? ?? '';
          final rawSmsId = item['smsId'] as String?;
          final smsId = (rawSmsId != null && rawSmsId.isNotEmpty) ? rawSmsId : id;
          final amount = double.tryParse(item['amount']?.toString() ?? '0') ?? 0.0;
          final category = (item['category'] as String? ?? 'OTHER_EXPENSE').toUpperCase();
          final note = item['note'] as String?;
          final dateStr = (item['occurredAt'] ?? item['createdAt']) as String?;
          final date = dateStr != null ? DateTime.tryParse(dateStr) ?? DateTime.now() : DateTime.now();

          // Detect recognized bank from bankSource, note, or tags
          BankSource? detectedBank;
          final bankSourceStr = item['bankSource'] as String?;
          if (bankSourceStr != null && bankSourceStr.isNotEmpty) {
            for (final b in BankSource.values) {
              if (b.name.toLowerCase() == bankSourceStr.toLowerCase() ||
                  b.label.toLowerCase() == bankSourceStr.toLowerCase()) {
                detectedBank = b;
                break;
              }
            }
          }
          if (detectedBank == null && note != null && note.isNotEmpty) {
            final lower = note.toLowerCase();
            for (final b in BankSource.values) {
              if (lower.contains(b.name.toLowerCase()) || lower.contains(b.label.toLowerCase())) {
                detectedBank = b;
                break;
              }
            }
          }

          items.add(
            Expense(
              smsId: smsId,
              amount: amount,
              category: category,
              source: detectedBank,
              date: date,
              note: note,
            ),
          );
        }

        _cachedExpenses = items;
        return items;
      }
    } catch (_) {}

    return _cachedExpenses;
  }

  @override
  Future<bool> exists(String smsId) async {
    return _cachedExpenses.any((e) => e.smsId == smsId);
  }
}

