import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import 'package:message/core/constants/bank_senders.dart';
import '../../../../auth/data/datasources/auth_datasource.dart';
import '../../../../expense/domain/usecases/is_sms_already_saved.dart';
import '../../../data/services/sms_anchor_date_service.dart';
import '../../../data/services/sms_bulk_sync_service.dart';
import '../../../domain/entities/bank_transaction.dart';
import '../../../domain/entities/sms_message.dart';
import '../../../domain/usecases/get_sms_history.dart';
import '../../../domain/usecases/listen_incoming_sms.dart';
import '../../../domain/usecases/parse_bank_sms.dart';
import 'sms_event.dart';
import 'sms_state.dart';

class SmsBloc extends Bloc<SmsEvent, SmsState> {
  SmsBloc({
    required this.getSmsHistory,
    required this.listenIncomingSms,
    required this.parseBankSms,
    required this.isSmsAlreadySaved,
    required this.smsBulkSyncService,
    required this.anchorDateService,
    required this.authDataSource,
  }) : super(const SmsState()) {
    on<SmsStarted>(_onStarted);
    on<SmsIncomingReceived>(_onIncoming);
    on<SmsTransactionHandled>(_onHandled);
  }

  final GetSmsHistory getSmsHistory;
  final ListenIncomingSms listenIncomingSms;
  final ParseBankSms parseBankSms;
  final IsSmsAlreadySaved isSmsAlreadySaved;
  final SmsBulkSyncService smsBulkSyncService;
  final SmsAnchorDateService anchorDateService;
  final AuthDataSource authDataSource;

  StreamSubscription<SmsMessageEntity>? _incomingSub;

  int _scanGeneration = 0;

  Future<void> _onStarted(SmsStarted event, Emitter<SmsState> emit) async {
    final currentGen = ++_scanGeneration;
    final timeFilter = event.timeFilter;

    // Initialize the anchor date using the true account registration date (user.createdAt - 30 days).
    // This date is permanently stored and will never change on subsequent logins or re-scans.
    final userId = authDataSource.getUserId();
    final userCreatedAt = authDataSource.getUserCreatedAt();
    final anchorDate = anchorDateService.initAnchor(
      userId: userId,
      registrationDate: userCreatedAt,
    );

    // UI filter cutoff — null means "All Time" (show everything since anchor)
    final uiCutoff = timeFilter.cutoffDate;

    emit(
      state.copyWith(
        status: SmsStatus.loading,
        isScanning: true,
        timeFilter: timeFilter,
      ),
    );

    try {
      final pending = <BankTransaction>[];
      final latestBalances = <BankSource, double>{};
      final latestDates = <BankSource, DateTime>{};
      int totalScanned = 0;
      bool isFirstBatch = true;

      // Always fetch from the anchor date — this never changes after first scan.
      await for (final page in getSmsHistory.streamPages(sinceDate: anchorDate)) {
        if (_scanGeneration != currentGen) return;

        totalScanned += page.length;
        for (final sms in page) {
          // Skip anything before the anchor (safety guard)
          if (sms.date.isBefore(anchorDate)) continue;

          final transaction = parseBankSms(sms);
          if (transaction == null) continue;

          // ALWAYS update balance from any SMS since the anchor date
          if (transaction.balanceAfter != null) {
            final currentDate = latestDates[transaction.source];
            if (currentDate == null || transaction.date.isAfter(currentDate)) {
              latestDates[transaction.source] = transaction.date;
              latestBalances[transaction.source] = transaction.balanceAfter!;
            }
          }

          // Add to pending if within the UI filter window (or all-time if null)
          final withinTimeFilter =
              uiCutoff == null || !sms.date.isBefore(uiCutoff);
          if (withinTimeFilter &&
              transaction.amount > 0 &&
              !await isSmsAlreadySaved(transaction.smsId)) {
            if (!pending.any((item) => item.smsId == transaction.smsId)) {
              pending.add(transaction);
            }
          }
        }

        if (isFirstBatch || pending.isNotEmpty || latestBalances.isNotEmpty) {
          isFirstBatch = false;
          pending.sort((a, b) => b.date.compareTo(a.date));
          emit(
            state.copyWith(
              status: SmsStatus.ready,
              pending: List.of(pending),
              latestBalanceByBank: Map.of(latestBalances),
              scannedCount: totalScanned,
              isScanning: true,
              timeFilter: timeFilter,
            ),
          );
        }

        // Micro-yield to keep UI ultra responsive
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }

      if (_scanGeneration != currentGen) return;

      pending.sort((a, b) => b.date.compareTo(a.date));
      emit(
        SmsState(
          status: SmsStatus.ready,
          pending: List.of(pending),
          latestBalanceByBank: Map.of(latestBalances),
          scannedCount: totalScanned,
          isScanning: false,
          timeFilter: timeFilter,
        ),
      );

      // Automatically sync all extracted bank transactions to PostgreSQL backend in bulk
      if (pending.isNotEmpty) {
        smsBulkSyncService.syncTransactions(pending).ignore();
      }

      await _incomingSub?.cancel();
      _incomingSub = listenIncomingSms().listen((message) {
        add(SmsIncomingReceived(message));
      });
    } catch (error) {
      if (_scanGeneration != currentGen) return;
      emit(
        state.copyWith(
          status: SmsStatus.failure,
          isScanning: false,
          message: error.toString(),
        ),
      );
    }
  }

  Future<void> _onIncoming(
    SmsIncomingReceived event,
    Emitter<SmsState> emit,
  ) async {
    final transaction = parseBankSms(event.message);
    if (transaction == null) return;

    final updatedBalances = Map<BankSource, double>.from(state.latestBalanceByBank);
    if (transaction.balanceAfter != null) {
      updatedBalances[transaction.source] = transaction.balanceAfter!;
    }

    // Balance-only SMS (amount == 0) → only update the balance display, don't add to pending
    if (transaction.amount <= 0) {
      emit(state.copyWith(latestBalanceByBank: updatedBalances));
      return;
    }

    if (await isSmsAlreadySaved(transaction.smsId)) {
      emit(state.copyWith(latestBalanceByBank: updatedBalances));
      return;
    }

    if (state.pending.any((item) => item.smsId == transaction.smsId)) return;
    emit(
      state.copyWith(
        status: SmsStatus.ready,
        pending: [transaction, ...state.pending],
        latestBalanceByBank: updatedBalances,
        promptIncoming: true,
      ),
    );

    // Auto-sync real-time incoming transaction to backend
    smsBulkSyncService.syncSingleTransaction(transaction).ignore();
  }

  void _onHandled(SmsTransactionHandled event, Emitter<SmsState> emit) {
    emit(
      state.copyWith(
        pending: state.pending
            .where((item) => item.smsId != event.smsId)
            .toList(),
        promptIncoming: false,
      ),
    );
  }

  @override
  Future<void> close() async {
    await _incomingSub?.cancel();
    return super.close();
  }
}
