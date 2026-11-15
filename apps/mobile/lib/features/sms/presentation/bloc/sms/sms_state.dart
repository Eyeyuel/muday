import 'package:equatable/equatable.dart';

import '../../../../../core/constants/bank_senders.dart';
import '../../../../../core/constants/sms_time_filter.dart';
import '../../../domain/entities/bank_transaction.dart';

enum SmsStatus { initial, loading, ready, failure }

class SmsState extends Equatable {
  const SmsState({
    this.status = SmsStatus.initial,
    this.pending = const [],
    this.latestBalanceByBank = const {},
    this.scannedCount = 0,
    this.isScanning = false,
    this.promptIncoming = false,
    this.timeFilter = SmsTimeFilter.monthly,
    this.message,
  });

  final SmsStatus status;
  final List<BankTransaction> pending;
  final Map<BankSource, double> latestBalanceByBank;
  final int scannedCount;
  final bool isScanning;
  final bool promptIncoming;
  final SmsTimeFilter timeFilter;
  final String? message;

  BankTransaction? get current => pending.isEmpty ? null : pending.first;

  Map<BankSource, List<BankTransaction>> get pendingByBank {
    final grouped = <BankSource, List<BankTransaction>>{};
    for (final transaction in pending) {
      grouped.putIfAbsent(transaction.source, () => []).add(transaction);
    }
    final entries = grouped.entries.toList()
      ..sort((a, b) => b.value.length.compareTo(a.value.length));
    return {for (final entry in entries) entry.key: entry.value};
  }

  SmsState copyWith({
    SmsStatus? status,
    List<BankTransaction>? pending,
    Map<BankSource, double>? latestBalanceByBank,
    int? scannedCount,
    bool? isScanning,
    bool? promptIncoming,
    SmsTimeFilter? timeFilter,
    String? message,
  }) {
    return SmsState(
      status: status ?? this.status,
      pending: pending ?? this.pending,
      latestBalanceByBank: latestBalanceByBank ?? this.latestBalanceByBank,
      scannedCount: scannedCount ?? this.scannedCount,
      isScanning: isScanning ?? this.isScanning,
      promptIncoming: promptIncoming ?? this.promptIncoming,
      timeFilter: timeFilter ?? this.timeFilter,
      message: message,
    );
  }

  @override
  List<Object?> get props => [
    status,
    pending,
    latestBalanceByBank,
    scannedCount,
    isScanning,
    promptIncoming,
    timeFilter,
    message,
  ];
}
