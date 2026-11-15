import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/bank_senders.dart';
import '../../../../../core/utils/money_utils.dart';
import '../../../../sms/domain/entities/bank_transaction.dart';
import '../../../../sms/presentation/bloc/sms/sms_bloc.dart';
import '../../../../sms/presentation/bloc/sms/sms_event.dart';
import '../../../../sms/presentation/bloc/sms/sms_state.dart';
import '../../bloc/expense/expense_bloc.dart';
import '../../bloc/expense/expense_state.dart';
import '../../widgets/bank_logo.dart';

/// Redesigned Bank Accounts & Balances Page
/// Displays all active bank accounts sorted from highest balance to lowest.
class BanksPage extends StatelessWidget {
  const BanksPage({
    super.key,
    this.onSelect,
  });

  final ValueChanged<BankTransaction>? onSelect;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);
    final cardBgColor = isDark ? const Color(0xFF130E26) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);
    const primaryEmerald = Color(0xFF10B981);

    return Scaffold(
      backgroundColor: backgroundColor,
      body: SafeArea(
        top: false,
        child: BlocBuilder<SmsBloc, SmsState>(
          builder: (context, smsState) {
            return BlocBuilder<ExpenseBloc, ExpenseState>(
              builder: (context, expenseState) {
                // 1. Gather all active banks with their balance and transaction volume
                final bankBalances = <BankSource, double>{};
                final bankTxCounts = <BankSource, int>{};
                final bankVolumes = <BankSource, double>{};

                // Add balance from latest SMS
                for (final entry in smsState.latestBalanceByBank.entries) {
                  bankBalances[entry.key] = entry.value;
                }

                // Add volume and count from expenses
                for (final exp in expenseState.expenses) {
                  if (exp.source != null) {
                    bankTxCounts[exp.source!] = (bankTxCounts[exp.source!] ?? 0) + 1;
                    bankVolumes[exp.source!] = (bankVolumes[exp.source!] ?? 0.0) + exp.amount;
                  }
                }

                // Add volume and count from pending
                for (final pending in smsState.pending) {
                  bankTxCounts[pending.source] = (bankTxCounts[pending.source] ?? 0) + 1;
                  bankVolumes[pending.source] = (bankVolumes[pending.source] ?? 0.0) + pending.amount;
                }

                // Combine all unique banks
                final allBanks = <BankSource>{
                  ...bankBalances.keys,
                  ...bankTxCounts.keys,
                }.toList();

                // Sort banks from highest balance / volume to lowest
                allBanks.sort((a, b) {
                  final balA = bankBalances[a] ?? bankVolumes[a] ?? 0.0;
                  final balB = bankBalances[b] ?? bankVolumes[b] ?? 0.0;
                  return balB.compareTo(balA);
                });

                // Calculate total balance
                final totalNetBalance = bankBalances.values.fold(0.0, (sum, bal) => sum + bal);

                return Column(
                  children: [
                    // Header Card
                    _buildTopHeader(
                      context: context,
                      isDark: isDark,
                      textColor: textColor,
                      subtextColor: subtextColor,
                      totalBalance: totalNetBalance,
                      bankCount: allBanks.length,
                    ),

                    // Banks List
                    Expanded(
                      child: allBanks.isEmpty
                          ? _buildEmptyState(context, isDark, textColor, subtextColor)
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
                              itemCount: allBanks.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 14),
                              itemBuilder: (context, index) {
                                final bank = allBanks[index];
                                final balance = bankBalances[bank];
                                final txCount = bankTxCounts[bank] ?? 0;
                                final volume = bankVolumes[bank] ?? 0.0;
                                final pendingTxs = smsState.pendingByBank[bank] ?? const <BankTransaction>[];

                                return _BankBalanceCard(
                                  bank: bank,
                                  balance: balance,
                                  txCount: txCount,
                                  volume: volume,
                                  pendingCount: pendingTxs.length,
                                  totalNetBalance: totalNetBalance > 0 ? totalNetBalance : null,
                                  isDark: isDark,
                                  cardBgColor: cardBgColor,
                                  textColor: textColor,
                                  subtextColor: subtextColor,
                                  primaryEmerald: primaryEmerald,
                                  rankIndex: index + 1,
                                );
                              },
                            ),
                    ),
                  ],
                );
              },
            );
          },
        ),
      ),
    );
  }

  Widget _buildTopHeader({
    required BuildContext context,
    required bool isDark,
    required Color textColor,
    required Color subtextColor,
    required double totalBalance,
    required int bankCount,
  }) {
    final topPad = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.fromLTRB(16, topPad + 8, 16, 18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF130E29) : Colors.white,
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(28),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.06),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
              Text(
                'Connected Accounts',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  letterSpacing: -0.2,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFF10B981).withValues(alpha: 0.25),
                  ),
                ),
                child: Text(
                  '$bankCount Banks',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF10B981),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Total Balance',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: subtextColor,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  MoneyUtils.formatBirr(totalBalance),
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: textColor,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Ranked from highest balance to lowest',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: subtextColor.withValues(alpha: 0.8),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    bool isDark,
    Color textColor,
    Color subtextColor,
  ) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
              ),
              child: const Icon(
                Icons.account_balance_rounded,
                size: 40,
                color: Color(0xFF10B981),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'No Connected Banks',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: textColor,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Sync bank SMS or record transactions to automatically detect your bank accounts.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: subtextColor, height: 1.4),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                context.read<SmsBloc>().add(const SmsStarted());
                Navigator.of(context).pop();
              },
              icon: const Icon(Icons.sync_rounded, size: 18),
              label: const Text('Scan & Detect Banks'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bank Balance Card displaying individual bank balance, rank, and statistics
class _BankBalanceCard extends StatelessWidget {
  const _BankBalanceCard({
    required this.bank,
    required this.balance,
    required this.txCount,
    required this.volume,
    required this.pendingCount,
    required this.totalNetBalance,
    required this.isDark,
    required this.cardBgColor,
    required this.textColor,
    required this.subtextColor,
    required this.primaryEmerald,
    required this.rankIndex,
  });

  final BankSource bank;
  final double? balance;
  final int txCount;
  final double volume;
  final int pendingCount;
  final double? totalNetBalance;
  final bool isDark;
  final Color cardBgColor;
  final Color textColor;
  final Color subtextColor;
  final Color primaryEmerald;
  final int rankIndex;

  @override
  Widget build(BuildContext context) {
    final hasBalance = balance != null && balance! > 0;
    final displayAmount = hasBalance ? balance! : volume;
    final percentage = (totalNetBalance != null && totalNetBalance! > 0 && hasBalance)
        ? (balance! / totalNetBalance!).clamp(0.0, 1.0)
        : null;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: cardBgColor,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? const Color(0xFF241B48) : const Color(0xFFE2E8F0),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top Row: Logo, Name, Rank Badge
          Row(
            children: [
              BankLogo(source: bank, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bank.label,
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$txCount transaction${txCount == 1 ? '' : 's'} recorded',
                      style: TextStyle(fontSize: 12, color: subtextColor),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E173E) : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isDark ? const Color(0xFF2E235E) : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Text(
                  '#$rankIndex',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: rankIndex == 1
                        ? const Color(0xFFF59E0B)
                        : (rankIndex == 2 ? const Color(0xFF3B82F6) : subtextColor),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Balance Display
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    hasBalance ? 'Available Balance' : 'Total Volume',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: subtextColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    MoneyUtils.formatBirr(displayAmount),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: textColor,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),

              if (pendingCount > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '$pendingCount Pending',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFFEF4444),
                    ),
                  ),
                ),
            ],
          ),

          // Share Progress Bar (if available)
          if (percentage != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: percentage,
                minHeight: 5,
                backgroundColor: isDark ? const Color(0xFF201742) : const Color(0xFFF1F5F9),
                valueColor: AlwaysStoppedAnimation<Color>(
                  rankIndex == 1
                      ? const Color(0xFF10B981)
                      : (rankIndex == 2 ? primaryEmerald : const Color(0xFF3B82F6)),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                '${(percentage * 100).toStringAsFixed(1)}% of total balance',
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  color: subtextColor,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
