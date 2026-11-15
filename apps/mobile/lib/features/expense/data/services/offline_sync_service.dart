import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:hive/hive.dart';
import '../../../auth/data/datasources/auth_datasource.dart';

class OfflineSyncService {
  OfflineSyncService(this._settingsBox, this._authDataSource);

  final Box<dynamic> _settingsBox;
  final AuthDataSource _authDataSource;

  static const _queueKey = 'offline_tx_sync_queue';

  bool _isFlushing = false;

  List<Map<String, dynamic>> _getQueue() {
    try {
      final raw = _settingsBox.get(_queueKey);
      if (raw is String && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is List) {
          return decoded.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        }
      }
    } catch (_) {}
    return [];
  }

  Future<void> _saveQueue(List<Map<String, dynamic>> queue) async {
    await _settingsBox.put(_queueKey, jsonEncode(queue));
  }

  int get pendingCount => _getQueue().length;

  Future<void> enqueueBankSms({
    required double amount,
    required String type,
    required String category,
    String? bankSource,
    DateTime? occurredAt,
    String? note,
    String? smsId,
  }) async {
    final queue = _getQueue();
    queue.add({
      'kind': 'bank_sms',
      'amount': amount,
      'type': type,
      'category': category,
      'bankSource': bankSource,
      'occurredAt': occurredAt?.toIso8601String(),
      'note': note,
      'smsId': smsId,
      'enqueuedAt': DateTime.now().toIso8601String(),
    });
    await _saveQueue(queue);
  }

  Future<void> enqueueBulkBankSms(List<Map<String, dynamic>> messages) async {
    if (messages.isEmpty) return;
    final queue = _getQueue();
    queue.add({
      'kind': 'bank_sms_bulk',
      'messages': messages,
      'enqueuedAt': DateTime.now().toIso8601String(),
    });
    await _saveQueue(queue);
  }

  Future<void> enqueueText(String textCommand) async {
    final queue = _getQueue();
    queue.add({
      'kind': 'text',
      'text': textCommand,
      'enqueuedAt': DateTime.now().toIso8601String(),
    });
    await _saveQueue(queue);
  }

  Future<int> flushQueue() async {
    if (_isFlushing) return 0;
    _isFlushing = true;

    final queue = _getQueue();
    if (queue.isEmpty) {
      _isFlushing = false;
      return 0;
    }

    final remaining = <Map<String, dynamic>>[];
    int successCount = 0;

    for (final item in queue) {
      try {
        final kind = item['kind'] as String? ?? 'text';
        if (kind == 'bank_sms_bulk') {
          final rawMessages = item['messages'];
          if (rawMessages is List && rawMessages.isNotEmpty) {
            final messages = rawMessages
                .map((m) => Map<String, dynamic>.from(m as Map))
                .toList();
            await _authDataSource.postBankSmsBulk(messages);
          }
        } else if (kind == 'bank_sms') {
          final occurredAtStr = item['occurredAt'] as String?;
          await _authDataSource.saveBankSmsTransaction(
            amount: double.tryParse(item['amount']?.toString() ?? '0') ?? 0.0,
            type: item['type'] as String? ?? 'expense',
            category: item['category'] as String? ?? 'uncategorized',
            bankSource: item['bankSource'] as String?,
            occurredAt: occurredAtStr != null ? DateTime.tryParse(occurredAtStr) : null,
            note: item['note'] as String?,
            smsId: item['smsId'] as String?,
            rawText: item['rawText'] as String?,
          );
        } else {
          final text = item['text'] as String? ?? '';
          if (text.isNotEmpty) {
            await _authDataSource.postTextTransaction(text);
          }
        }
        successCount++;
      } catch (e) {
        debugPrint('[OfflineSync] Failed to sync item: $e');
        remaining.add(item);
      }
    }

    await _saveQueue(remaining);
    _isFlushing = false;
    return successCount;
  }
}
