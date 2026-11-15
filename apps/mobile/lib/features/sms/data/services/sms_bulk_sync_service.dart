import 'package:flutter/foundation.dart';
import '../../../auth/data/datasources/auth_datasource.dart';
import '../../../expense/data/services/offline_sync_service.dart';
import '../../domain/entities/bank_transaction.dart';

class SmsBulkSyncService {
  SmsBulkSyncService(this._authDataSource, this._offlineSyncService);

  final AuthDataSource _authDataSource;
  final OfflineSyncService _offlineSyncService;

  static const int chunkSize = 40;

  Map<String, dynamic> toBackendPayload(BankTransaction tx) {
    return {
      'amount': tx.amount,
      'type': tx.flow == TransactionFlow.received ? 'income' : 'expense',
      'category': 'uncategorized',
      'bankSource': tx.source.name,
      'occurredAt': tx.date.toUtc().toIso8601String(),
      'note': 'From ${tx.source.label} SMS',
      'smsId': tx.smsId,
      'rawText': tx.rawBody,
    };
  }

  Future<Map<String, dynamic>> syncTransactions(List<BankTransaction> transactions) async {
    final validTx = transactions.where((tx) => tx.amount > 0).toList();
    if (validTx.isEmpty) {
      return {'success': true, 'processed': 0, 'saved': 0, 'duplicates': 0};
    }

    final messages = validTx.map(toBackendPayload).toList();
    int totalProcessed = 0;
    bool anyOfflineEnqueued = false;

    // Split large batches into chunks of 40 (recommended 30-50 per request)
    for (int i = 0; i < messages.length; i += chunkSize) {
      final end = (i + chunkSize < messages.length) ? i + chunkSize : messages.length;
      final chunk = messages.sublist(i, end);

      try {
        final result = await _authDataSource.postBankSmsBulk(chunk);
        final processed = (result['processed'] as num?)?.toInt() ?? chunk.length;
        totalProcessed += processed;
        debugPrint('[SmsBulkSync] Synced chunk (${chunk.length} items): $result');
      } catch (e) {
        debugPrint('[SmsBulkSync] Network sync failed for chunk, enqueuing ${chunk.length} to offline outbox: $e');
        await _offlineSyncService.enqueueBulkBankSms(chunk);
        anyOfflineEnqueued = true;
      }
    }

    return {
      'success': true,
      'processed': totalProcessed,
      'offlineEnqueued': anyOfflineEnqueued,
      'total': messages.length,
    };
  }

  Future<Map<String, dynamic>> syncSingleTransaction(BankTransaction tx) async {
    if (tx.amount <= 0) {
      return {'success': true, 'processed': 0};
    }
    return syncTransactions([tx]);
  }
}
