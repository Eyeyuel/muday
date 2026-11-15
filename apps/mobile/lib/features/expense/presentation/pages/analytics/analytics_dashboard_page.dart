import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/bank_senders.dart';
import '../../../../../core/constants/categories.dart';
import '../../../../../core/di/injection.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../auth/data/datasources/auth_datasource.dart';
import '../../../../sms/presentation/bloc/sms/sms_bloc.dart';
import '../../../../sms/presentation/bloc/sms/sms_state.dart';
import '../../bloc/expense/expense_bloc.dart';
import '../../bloc/expense/expense_state.dart';
import '../../../domain/entities/expense.dart';
import '../../widgets/bank_logo.dart';

enum AnalyticsPeriod { daily, weekly, monthly, allTime }

extension AnalyticsPeriodExt on AnalyticsPeriod {
  String get label {
    switch (this) {
      case AnalyticsPeriod.daily:
        return 'Daily';
      case AnalyticsPeriod.weekly:
        return 'Weekly';
      case AnalyticsPeriod.monthly:
        return 'Monthly';
      case AnalyticsPeriod.allTime:
        return 'All Time';
    }
  }

  DateTime? get cutoffDate {
    final now = DateTime.now();
    switch (this) {
      case AnalyticsPeriod.daily:
        return DateTime(now.year, now.month, now.day);
      case AnalyticsPeriod.weekly:
        return now.subtract(const Duration(days: 7));
      case AnalyticsPeriod.monthly:
        return DateTime(now.year, now.month, 1);
      case AnalyticsPeriod.allTime:
        return null;
    }
  }
}

class AnalyticsDashboardPage extends StatefulWidget {
  const AnalyticsDashboardPage({super.key});

  @override
  State<AnalyticsDashboardPage> createState() => _AnalyticsDashboardPageState();
}

class _AnalyticsDashboardPageState extends State<AnalyticsDashboardPage> {
  AnalyticsPeriod _selectedPeriod = AnalyticsPeriod.monthly;
  bool _isLoadingHistory = false;
  List<Map<String, dynamic>> _serverTransactions = [];

  @override
  void initState() {
    super.initState();
    _fetchServerHistory();
  }

  Future<void> _fetchServerHistory() async {
    setState(() => _isLoadingHistory = true);
    try {
      final authDataSource = sl<AuthDataSource>();
      final history = await authDataSource.getTransactionHistory(limit: 100);
      if (mounted) {
        setState(() {
          _serverTransactions = history;
          _isLoadingHistory = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingHistory = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF130E29) : Colors.white;
    final backgroundColor = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Financial Analytics',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        actions: [
          if (_isLoadingHistory)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: _fetchServerHistory,
              tooltip: 'Refresh',
            ),
        ],
      ),
      body: BlocBuilder<ExpenseBloc, ExpenseState>(
        builder: (context, expenseState) {
          return BlocBuilder<SmsBloc, SmsState>(
            builder: (context, smsState) {
              // Combine all available transaction records
              final cutoff = _selectedPeriod.cutoffDate;

              // Local categorized expenses
              final List<Expense> localExpenses = expenseState.expenses.where((e) {
                if (cutoff == null) return true;
                return !e.date.isBefore(cutoff);
              }).toList();

              // Pending SMS expenses
              final List<Expense> pendingExpenses = smsState.pending
                  .where((p) => cutoff == null || !p.date.isBefore(cutoff))
                  .map((p) => Expense(
                        smsId: p.smsId,
                        amount: p.amount,
                        category: ExpenseCategories.uncategorized,
                        source: p.source,
                        date: p.date,
                        note: p.sender,
                      ))
                  .toList();

              // Server income & expense items
              double serverIncome = 0.0;
              double serverExpense = 0.0;
              final List<_DashboardTxItem> allItems = [];

              for (final e in localExpenses) {
                allItems.add(_DashboardTxItem(
                  title: e.note?.isNotEmpty == true
                      ? e.note!
                      : ExpenseCategories.getLabel(e.category),
                  category: e.category,
                  amount: e.amount,
                  isIncome: false,
                  source: e.source,
                  date: e.date,
                ));
              }

              for (final p in pendingExpenses) {
                allItems.add(_DashboardTxItem(
                  title: p.source?.label ?? 'Pending',
                  category: 'PENDING',
                  amount: p.amount,
                  isIncome: false,
                  source: p.source,
                  date: p.date,
                ));
              }

              for (final s in _serverTransactions) {
                final amount = double.tryParse(s['amount']?.toString() ?? '0') ?? 0.0;
                final isInc = (s['type'] as String? ?? '').toLowerCase() == 'income';
                final dateStr = (s['occurredAt'] ?? s['createdAt']) as String?;
                final date = dateStr != null ? DateTime.tryParse(dateStr) ?? DateTime.now() : DateTime.now();

                if (cutoff != null && date.isBefore(cutoff)) continue;

                if (isInc) {
                  serverIncome += amount;
                  allItems.add(_DashboardTxItem(
                    title: s['note'] ?? 'Income',
                    category: (s['category'] as String? ?? 'OTHER_INCOME').toUpperCase(),
                    amount: amount,
                    isIncome: true,
                    source: null,
                    date: date,
                  ));
                }
              }

              // Calculate Totals
              final totalExpense = localExpenses.fold<double>(0.0, (s, e) => s + e.amount) +
                  pendingExpenses.fold<double>(0.0, (s, e) => s + e.amount) +
                  serverExpense;
              final totalIncome = serverIncome;
              final netCashflow = totalIncome - totalExpense;
              final savingsRate = totalIncome > 0 ? ((netCashflow / totalIncome) * 100).clamp(-100.0, 100.0) : 0.0;

              // Group by category for visual breakdown
              final Map<String, double> categoryTotals = {};
              final Map<BankSource, double> bankTotals = {};

              for (final item in allItems) {
                if (!item.isIncome) {
                  categoryTotals[item.category] = (categoryTotals[item.category] ?? 0.0) + item.amount;
                  if (item.source != null) {
                    bankTotals[item.source!] = (bankTotals[item.source!] ?? 0.0) + item.amount;
                  }
                }
              }

              final sortedCategories = categoryTotals.entries.toList()
                ..sort((a, b) => b.value.compareTo(a.value));

              final sortedBanks = bankTotals.entries.toList()
                ..sort((a, b) => b.value.compareTo(a.value));

              // Largest Outflows
              final largestExpenses = allItems.where((i) => !i.isIncome).toList()
                ..sort((a, b) => b.amount.compareTo(a.amount));

              return RefreshIndicator(
                color: AppColors.primary,
                onRefresh: _fetchServerHistory,
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 1. Period Selector Tabs
                      _buildPeriodSelector(isDark),
                      const SizedBox(height: 16),

                      // 2. Summary Metric Cards
                      _buildSummaryCard(
                        isDark: isDark,
                        cardColor: cardColor,
                        textColor: textColor,
                        subtextColor: subtextColor,
                        totalIncome: totalIncome,
                        totalExpense: totalExpense,
                        netCashflow: netCashflow,
                        savingsRate: savingsRate,
                      ),
                      const SizedBox(height: 20),

                      // 3. Visual Spending Chart (Bar Chart)
                      _buildChartSection(
                        isDark: isDark,
                        cardColor: cardColor,
                        textColor: textColor,
                        subtextColor: subtextColor,
                        items: allItems,
                        period: _selectedPeriod,
                      ),
                      const SizedBox(height: 20),

                      // 4. Category Breakdown Progress Bars
                      _buildCategoryBreakdown(
                        isDark: isDark,
                        cardColor: cardColor,
                        textColor: textColor,
                        subtextColor: subtextColor,
                        categories: sortedCategories,
                        totalExpense: totalExpense,
                      ),
                      const SizedBox(height: 20),

                      // 5. Bank Distribution Cards
                      if (sortedBanks.isNotEmpty) ...[
                        _buildBankDistribution(
                          isDark: isDark,
                          cardColor: cardColor,
                          textColor: textColor,
                          subtextColor: subtextColor,
                          banks: sortedBanks,
                          totalExpense: totalExpense,
                        ),
                        const SizedBox(height: 20),
                      ],

                      // 6. Top Outflows
                      if (largestExpenses.isNotEmpty) ...[
                        _buildTopOutflows(
                          isDark: isDark,
                          cardColor: cardColor,
                          textColor: textColor,
                          subtextColor: subtextColor,
                          items: largestExpenses.take(5).toList(),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  // ─── Period Selector ────────────────────────────────────────────────────────
  Widget _buildPeriodSelector(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1C1C22) : const Color(0xFFEBEBF0),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: AnalyticsPeriod.values.map((period) {
          final isSelected = _selectedPeriod == period;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _selectedPeriod = period),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isDark ? const Color(0xFF383842) : Colors.white)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Text(
                  period.label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected
                        ? (isDark ? Colors.white : const Color(0xFF111827))
                        : (isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280)),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ─── Summary Metric Card ───────────────────────────────────────────────────
  Widget _buildSummaryCard({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required double totalIncome,
    required double totalExpense,
    required double netCashflow,
    required double savingsRate,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF26262F) : const Color(0xFFE5E7EB),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Total Spend (${_selectedPeriod.label})',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: subtextColor),
              ),
              if (savingsRate != 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: savingsRate >= 0
                        ? const Color(0xFF10B981).withValues(alpha: 0.15)
                        : const Color(0xFFEF4444).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${savingsRate >= 0 ? '+' : ''}${savingsRate.toStringAsFixed(1)}% savings',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: savingsRate >= 0 ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'ETB ${totalExpense.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: textColor,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 18),
          const Divider(height: 1),
          const SizedBox(height: 16),
          Row(
            children: [
              // Income Column
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                      ),
                      child: const Icon(Icons.arrow_downward_rounded, color: Color(0xFF10B981), size: 18),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Income', style: TextStyle(fontSize: 11.5, color: subtextColor, fontWeight: FontWeight.w500)),
                        const SizedBox(height: 2),
                        Text(
                          '+ETB ${totalIncome.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFF10B981)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // Expense Column
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFEF4444).withValues(alpha: 0.15),
                      ),
                      child: const Icon(Icons.arrow_upward_rounded, color: Color(0xFFEF4444), size: 18),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Expense', style: TextStyle(fontSize: 11.5, color: subtextColor, fontWeight: FontWeight.w500)),
                        const SizedBox(height: 2),
                        Text(
                          '-ETB ${totalExpense.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Color(0xFFEF4444)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Visual Spending Chart (Bar Chart) ─────────────────────────────────────
  Widget _buildChartSection({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required List<_DashboardTxItem> items,
    required AnalyticsPeriod period,
  }) {
    final List<_ChartBarData> bars = _computeChartBars(items, period);
    final maxAmount = bars.fold<double>(0.0, (max, b) => b.amount > max ? b.amount : max);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF26262F) : const Color(0xFFE5E7EB),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Spending Activity',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
              ),
              Text(
                'Peak: ETB ${maxAmount.toStringAsFixed(0)}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Bar Chart Canvas
          SizedBox(
            height: 140,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: bars.map((bar) {
                final ratio = maxAmount > 0 ? (bar.amount / maxAmount).clamp(0.06, 1.0) : 0.06;
                final isPeak = maxAmount > 0 && bar.amount == maxAmount && bar.amount > 0;

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        if (bar.amount > 0)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(
                              bar.amount >= 1000
                                  ? '${(bar.amount / 1000).toStringAsFixed(1)}k'
                                  : bar.amount.toStringAsFixed(0),
                              style: TextStyle(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w700,
                                color: isPeak ? AppColors.primary : subtextColor,
                              ),
                            ),
                          ),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 400),
                          height: 80 * ratio,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: isPeak
                                  ? [const Color(0xFF10B981), const Color(0xFF059669)]
                                  : (isDark
                                      ? [const Color(0xFF4B4B58), const Color(0xFF32323D)]
                                      : [const Color(0xFFCBD5E1), const Color(0xFF94A3B8)]),
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          bar.label,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isPeak ? FontWeight.w700 : FontWeight.w500,
                            color: isPeak ? textColor : subtextColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  List<_ChartBarData> _computeChartBars(List<_DashboardTxItem> items, AnalyticsPeriod period) {
    final now = DateTime.now();

    if (period == AnalyticsPeriod.daily) {
      final blocks = ['Morning', 'Noon', 'Evening', 'Night'];
      final amounts = [0.0, 0.0, 0.0, 0.0];

      for (final item in items) {
        if (!item.isIncome) {
          final h = item.date.hour;
          if (h >= 5 && h < 12) {
            amounts[0] += item.amount;
          } else if (h >= 12 && h < 17) {
            amounts[1] += item.amount;
          } else if (h >= 17 && h < 22) {
            amounts[2] += item.amount;
          } else {
            amounts[3] += item.amount;
          }
        }
      }
      return List.generate(4, (i) => _ChartBarData(label: blocks[i], amount: amounts[i]));
    } else if (period == AnalyticsPeriod.weekly) {
      final List<_ChartBarData> result = [];
      for (int i = 6; i >= 0; i--) {
        final d = now.subtract(Duration(days: i));
        final dayName = DateFormat('E').format(d);
        final sum = items
            .where((it) =>
                !it.isIncome &&
                it.date.year == d.year &&
                it.date.month == d.month &&
                it.date.day == d.day)
            .fold<double>(0.0, (s, it) => s + it.amount);
        result.add(_ChartBarData(label: dayName, amount: sum));
      }
      return result;
    } else {
      final List<_ChartBarData> result = [];
      for (int w = 1; w <= 4; w++) {
        final sum = items
            .where((it) => !it.isIncome && (it.date.day >= (w - 1) * 7 + 1 && it.date.day <= w * 7))
            .fold<double>(0.0, (s, it) => s + it.amount);
        result.add(_ChartBarData(label: 'W$w', amount: sum));
      }
      return result;
    }
  }

  // ─── Category Breakdown Progress Bars ──────────────────────────────────────
  Widget _buildCategoryBreakdown({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required List<MapEntry<String, double>> categories,
    required double totalExpense,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF26262F) : const Color(0xFFE5E7EB),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Category Breakdown',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
              ),
              Text(
                '${categories.length} Categories',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: subtextColor),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (categories.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text('No expenses recorded in this period', style: TextStyle(color: subtextColor)),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: categories.length,
              separatorBuilder: (context, i) => const SizedBox(height: 14),
              itemBuilder: (context, i) {
                final entry = categories[i];
                final catKey = entry.key;
                final amount = entry.value;
                final percent = totalExpense > 0 ? (amount / totalExpense) : 0.0;
                final catColor = ExpenseCategories.getColor(catKey);
                final catIcon = ExpenseCategories.getIcon(catKey);
                final catName = ExpenseCategories.getLabel(catKey);

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: catColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(catIcon, color: catColor, size: 16),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            catName,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: textColor),
                          ),
                        ),
                        Text(
                          '${(percent * 100).toStringAsFixed(1)}%',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: subtextColor),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'ETB ${amount.toStringAsFixed(2)}',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: textColor),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: percent.clamp(0.0, 1.0),
                        backgroundColor: isDark ? const Color(0xFF262630) : const Color(0xFFE5E7EB),
                        valueColor: AlwaysStoppedAnimation<Color>(catColor),
                        minHeight: 6,
                      ),
                    ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  // ─── Bank Distribution Cards ──────────────────────────────────────────────
  Widget _buildBankDistribution({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required List<MapEntry<BankSource, double>> banks,
    required double totalExpense,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF26262F) : const Color(0xFFE5E7EB),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bank Accounts Distribution',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
          ),
          const SizedBox(height: 14),
          Row(
            children: banks.map((entry) {
              final bank = entry.key;
              final amount = entry.value;
              final percent = totalExpense > 0 ? (amount / totalExpense * 100) : 0.0;

              return Expanded(
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF212128) : const Color(0xFFF3F4F8),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      BankLogo(source: bank, size: 28, showBorder: false),
                      const SizedBox(height: 8),
                      Text(
                        bank.label,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: textColor),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${percent.toStringAsFixed(1)}%',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.primary),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'ETB ${amount.toStringAsFixed(0)}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: textColor),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  // ─── Top Outflows ─────────────────────────────────────────────────────────
  Widget _buildTopOutflows({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required List<_DashboardTxItem> items,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? const Color(0xFF26262F) : const Color(0xFFE5E7EB),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Largest Outflows',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
          ),
          const SizedBox(height: 12),
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            separatorBuilder: (context, i) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final item = items[i];
              final catColor = ExpenseCategories.getColor(item.category);
              final catIcon = ExpenseCategories.getIcon(item.category);

              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: catColor.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(catIcon, color: catColor, size: 18),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.title,
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: textColor),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${item.source != null ? '${item.source!.label} · ' : ''}${DateFormat('d MMM, hh:mm a').format(item.date)}',
                            style: TextStyle(fontSize: 11, color: subtextColor),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '-ETB ${item.amount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ChartBarData {
  const _ChartBarData({required this.label, required this.amount});
  final String label;
  final double amount;
}

class _DashboardTxItem {
  const _DashboardTxItem({
    required this.title,
    required this.category,
    required this.amount,
    required this.isIncome,
    this.source,
    required this.date,
  });

  final String title;
  final String category;
  final double amount;
  final bool isIncome;
  final BankSource? source;
  final DateTime date;
}
