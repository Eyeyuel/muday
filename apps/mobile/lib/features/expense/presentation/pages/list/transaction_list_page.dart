import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../../core/constants/categories.dart';
import '../../../../../core/di/injection.dart';
import '../../../../auth/data/datasources/auth_datasource.dart';
import 'package:message/features/expense/data/services/offline_sync_service.dart';
import '../../bloc/expense/expense_bloc.dart';
import '../../bloc/expense/expense_state.dart';

class ApiTransactionItem {
  const ApiTransactionItem({
    required this.id,
    required this.type,
    required this.amount,
    required this.currency,
    required this.category,
    this.note,
    required this.createdAt,
  });

  final String id;
  final String type; // 'expense' | 'income'
  final double amount;
  final String currency;
  final String category;
  final String? note;
  final DateTime createdAt;

  factory ApiTransactionItem.fromJson(Map<String, dynamic> json) {
    return ApiTransactionItem(
      id: json['id'] as String? ?? '',
      type: (json['type'] as String? ?? 'expense').toLowerCase(),
      amount: double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      currency: json['currency'] as String? ?? 'ETB',
      category: json['category'] as String? ?? 'OTHER_EXPENSE',
      note: json['note'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  bool get isIncome => type == 'income';
}

class TransactionListPage extends StatefulWidget {
  const TransactionListPage({
    super.key,
    this.onAddTapped,
    this.isActive = false,
  });

  final VoidCallback? onAddTapped;
  final bool isActive;

  @override
  State<TransactionListPage> createState() => _TransactionListPageState();
}

class _TransactionListPageState extends State<TransactionListPage> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedFilter = 'All';

  bool _isLoading = true;
  String? _errorMessage;
  List<ApiTransactionItem> _transactions = [];

  static const List<({String label, IconData icon})> _filters = [
    (label: 'All', icon: Icons.grid_view_rounded),
    (label: 'Expenses', icon: Icons.arrow_outward_rounded),
    (label: 'Income', icon: Icons.arrow_downward_rounded),
    (label: 'Food', icon: Icons.restaurant_rounded),
    (label: 'Transport', icon: Icons.directions_car_filled_rounded),
    (label: 'Bills', icon: Icons.receipt_long_rounded),
  ];

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  @override
  void didUpdateWidget(covariant TransactionListPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _fetchHistory(silent: true);
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchHistory({bool silent = false}) async {
    if (!silent || _transactions.isEmpty) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      // Flush offline queue in background
      sl<OfflineSyncService>().flushQueue().ignore();

      final authDataSource = sl<AuthDataSource>();
      final serverList = await authDataSource.getTransactionHistory(limit: 100);
      final items = serverList.map(ApiTransactionItem.fromJson).toList();
      items.sort((a, b) => b.createdAt.compareTo(a.createdAt));

      if (mounted) {
        setState(() {
          _transactions = items;
          _isLoading = false;
          _errorMessage = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          if (_transactions.isEmpty) {
            _errorMessage = e.toString().replaceAll('Exception: ', '');
          }
          _isLoading = false;
        });
      }
    }
  }

  static IconData _getCategoryIcon(String category, bool isIncome) {
    if (isIncome) return Icons.arrow_downward_rounded;
    return ExpenseCategories.getIcon(category);
  }

  static Color _getCategoryColor(String category, bool isIncome) {
    if (isIncome) return const Color(0xFF10B981);
    return ExpenseCategories.getColor(category);
  }

  String _formatCategoryName(String raw) {
    return ExpenseCategories.getLabel(raw);
  }

  String _getDateHeader(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final itemDate = DateTime(date.year, date.month, date.day);

    if (itemDate == today) {
      return 'Today';
    } else if (itemDate == today.subtract(const Duration(days: 1))) {
      return 'Yesterday';
    } else if (now.difference(itemDate).inDays < 7) {
      return DateFormat('EEEE').format(date);
    } else {
      return DateFormat('MMM d, yyyy').format(date);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);
    final cardColor = isDark ? const Color(0xFF130E29) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);
    const primaryEmerald = Color(0xFF10B981);

    // Apply search and filter
    final filtered = _transactions.where((t) {
      // Search
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final noteMatch = t.note?.toLowerCase().contains(q) ?? false;
        final catMatch = t.category.toLowerCase().contains(q);
        final amtMatch = t.amount.toString().contains(q);
        if (!noteMatch && !catMatch && !amtMatch) return false;
      }

      // Filter chips
      if (_selectedFilter == 'Expenses' && t.isIncome) return false;
      if (_selectedFilter == 'Income' && !t.isIncome) return false;
      if (_selectedFilter != 'All' &&
          _selectedFilter != 'Expenses' &&
          _selectedFilter != 'Income' &&
          !t.category.toLowerCase().contains(_selectedFilter.toLowerCase())) {
        return false;
      }

      return true;
    }).toList();

    final totalExpense = filtered
        .where((t) => !t.isIncome)
        .fold<double>(0.0, (sum, t) => sum + t.amount);

    final totalIncome = filtered
        .where((t) => t.isIncome)
        .fold<double>(0.0, (sum, t) => sum + t.amount);

    // Group by Date
    final Map<String, List<ApiTransactionItem>> grouped = {};
    for (final item in filtered) {
      final header = _getDateHeader(item.createdAt);
      grouped.putIfAbsent(header, () => []).add(item);
    }

    return BlocListener<ExpenseBloc, ExpenseState>(
      listenWhen: (prev, curr) => curr.status == ExpenseStatus.ready,
      listener: (context, state) {
        _fetchHistory(silent: true);
      },
      child: Scaffold(
        backgroundColor: bgColor,
        body: Column(
          children: [
            // 1. Enterprise Zen Header Card with Stats
            _buildEnterpriseHeader(
              isDark: isDark,
              textColor: textColor,
              subtextColor: subtextColor,
              totalExpense: totalExpense,
              totalIncome: totalIncome,
              recordCount: filtered.length,
            ),

            // 2. Search & Segmented Filter Pills
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
              child: Column(
                children: [
                  // Search Box
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF130E26) : Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isDark ? const Color(0xFF261D4A) : const Color(0xFFE2E8F0),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.03),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: TextStyle(fontSize: 14, color: textColor, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Search note, category or amount...',
                        hintStyle: TextStyle(fontSize: 13, color: subtextColor),
                        prefixIcon: Icon(Icons.search_rounded, color: subtextColor, size: 20),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18),
                                color: subtextColor,
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _searchQuery = '');
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    child: Row(
                      children: _filters.map((f) {
                        final isSelected = _selectedFilter == f.label;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedFilter = f.label),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              gradient: isSelected
                                  ? const LinearGradient(
                                      colors: [Color(0xFF10B981), Color(0xFF059669)],
                                    )
                                  : null,
                              color: isSelected
                                  ? primaryEmerald
                                  : (isDark ? const Color(0xFF15102C) : const Color(0xFFF1F5F9)),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected
                                    ? primaryEmerald
                                    : (isDark ? const Color(0xFF261E4E) : const Color(0xFFE2E8F0)),
                              ),
                              boxShadow: isSelected
                                  ? [
                                      BoxShadow(
                                        color: primaryEmerald.withValues(alpha: 0.35),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  f.icon,
                                  size: 14,
                                  color: isSelected ? Colors.white : subtextColor,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  f.label,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    color: isSelected ? Colors.white : subtextColor,
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
            ),

            // 3. Transactions Grouped List
            Expanded(
              child: RefreshIndicator(
                onRefresh: _fetchHistory,
                color: primaryEmerald,
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: primaryEmerald, strokeWidth: 2.5),
                      )
                    : _errorMessage != null
                        ? _buildErrorView(isDark, cardColor, textColor, subtextColor)
                        : filtered.isEmpty
                            ? _buildEmptyView(isDark, cardColor, textColor, subtextColor)
                            : ListView.builder(
                                key: const PageStorageKey('history_tx_list'),
                                physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
                                padding: const EdgeInsets.fromLTRB(20, 4, 20, 110),
                                itemCount: grouped.keys.length,
                                itemBuilder: (context, index) {
                                  final header = grouped.keys.elementAt(index);
                                  final items = grouped[header]!;

                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Date Section Header
                                      Padding(
                                        padding: const EdgeInsets.only(top: 14, bottom: 8, left: 4),
                                        child: Text(
                                          header.toUpperCase(),
                                          style: TextStyle(
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w800,
                                            color: subtextColor,
                                            letterSpacing: 0.8,
                                          ),
                                        ),
                                      ),

                                      // Item Container Card
                                      Container(
                                        decoration: BoxDecoration(
                                          color: cardColor,
                                          borderRadius: BorderRadius.circular(20),
                                          border: Border.all(
                                            color: isDark
                                                ? const Color(0xFF231A47)
                                                : const Color(0xFFE2E8F0),
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withValues(alpha: isDark ? 0.25 : 0.03),
                                              blurRadius: 12,
                                              offset: const Offset(0, 4),
                                            ),
                                          ],
                                        ),
                                        child: ListView.separated(
                                          shrinkWrap: true,
                                          physics: const NeverScrollableScrollPhysics(),
                                          itemCount: items.length,
                                          separatorBuilder: (ctx, i) => Divider(
                                            height: 1,
                                            indent: 64,
                                            endIndent: 16,
                                            color: isDark
                                                ? const Color(0xFF1E173E)
                                                : const Color(0xFFF1F5F9),
                                          ),
                                          itemBuilder: (context, i) {
                                            final item = items[i];
                                            return _buildTransactionRow(
                                              item: item,
                                              isDark: isDark,
                                              textColor: textColor,
                                              subtextColor: subtextColor,
                                            );
                                          },
                                        ),
                                      ),
                                    ],
                                  );
                                },
                              ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header Widget ──
  Widget _buildEnterpriseHeader({
    required bool isDark,
    required Color textColor,
    required Color subtextColor,
    required double totalExpense,
    required double totalIncome,
    required int recordCount,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF130E29) : Colors.white,
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.45 : 0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
      ),
      child: Builder(
        builder: (context) {
          final topPad = MediaQuery.of(context).padding.top;
          return Padding(
            padding: EdgeInsets.fromLTRB(20, topPad + 10, 20, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              // Top Bar: Brand & Action Icons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset(
                          'assets/images/muday_logo.png',
                          width: 32,
                          height: 32,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Center(
                                child: Text('M', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'MUDAY',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: textColor,
                              letterSpacing: 0.8,
                            ),
                          ),
                          Text(
                            'Transaction History',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: subtextColor,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  // Refresh Action Button
                  IconButton(
                    onPressed: _isLoading ? null : () => _fetchHistory(),
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    color: const Color(0xFF10B981),
                    tooltip: 'Refresh History',
                  ),
                ],
              ),

              const SizedBox(height: 14),

              // Overview Cards Row
              Row(
                children: [
                  // Total Outflows Card
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Total Outflow',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: subtextColor),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'ETB ${totalExpense.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFFEF4444),
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(width: 10),

                  // Total Inflow Card (or Count Card)
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            totalIncome > 0 ? 'Total Inflow' : 'Records Logged',
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: subtextColor),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            totalIncome > 0
                                ? '+ETB ${totalIncome.toStringAsFixed(2)}'
                                : '$recordCount items',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: totalIncome > 0 ? const Color(0xFF10B981) : textColor,
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          );
        },
      ),
    );
  }

  // ── Single Transaction Row ──
  Widget _buildTransactionRow({
    required ApiTransactionItem item,
    required bool isDark,
    required Color textColor,
    required Color subtextColor,
  }) {
    final catColor = _getCategoryColor(item.category, item.isIncome);
    final catIcon = _getCategoryIcon(item.category, item.isIncome);
    final timeStr = DateFormat('h:mm a').format(item.createdAt);

    return InkWell(
      onTap: () => _showTransactionDetailsSheet(item),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            // Category Icon Badge
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: catColor.withValues(alpha: isDark ? 0.18 : 0.12),
                shape: BoxShape.circle,
                border: Border.all(
                  color: catColor.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
              child: Icon(catIcon, color: catColor, size: 20),
            ),

            const SizedBox(width: 14),

            // Note & Category Description
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.note != null && item.note!.trim().isNotEmpty
                        ? item.note!
                        : _formatCategoryName(item.category),
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                      letterSpacing: -0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Text(
                        _formatCategoryName(item.category),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: subtextColor,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '•  $timeStr',
                        style: TextStyle(fontSize: 11.5, color: subtextColor.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(width: 10),

            // Amount Column
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${item.isIncome ? '+' : '-'}${item.amount.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: item.isIncome ? const Color(0xFF10B981) : textColor,
                    letterSpacing: -0.3,
                  ),
                ),
                Text(
                  item.currency,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: subtextColor,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Details Bottom Sheet ──
  void _showTransactionDetailsSheet(ApiTransactionItem item) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF141026) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);
    final catColor = _getCategoryColor(item.category, item.isIncome);
    final catIcon = _getCategoryIcon(item.category, item.isIncome);

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2D2550) : const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Top Badge & Amount
                Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: catColor.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(catIcon, color: catColor, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _formatCategoryName(item.category),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: textColor,
                            ),
                          ),
                          Text(
                            item.isIncome ? 'Income Inflow' : 'Expense Outflow',
                            style: TextStyle(fontSize: 12, color: subtextColor),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      '${item.isIncome ? '+' : '-'}${item.amount.toStringAsFixed(2)} ${item.currency}',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: item.isIncome ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 22),

                // Info Rows
                _buildSheetInfoRow('Date & Time', DateFormat('MMM d, yyyy  •  h:mm a').format(item.createdAt), textColor, subtextColor),
                if (item.note != null && item.note!.trim().isNotEmpty)
                  _buildSheetInfoRow('Note / Description', item.note!, textColor, subtextColor),
                _buildSheetInfoRow('Status', 'Recorded & Verified', const Color(0xFF10B981), subtextColor),

                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSheetInfoRow(String label, String value, Color valColor, Color subtextColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: subtextColor, fontWeight: FontWeight.w600)),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              value,
              style: TextStyle(fontSize: 13.5, color: valColor, fontWeight: FontWeight.w700),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }

  // ── Error View ──
  Widget _buildErrorView(bool isDark, Color cardColor, Color textColor, Color subtextColor) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.cloud_off_rounded, color: Color(0xFFEF4444), size: 36),
            ),
            const SizedBox(height: 16),
            Text(
              'Could not load history',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: textColor),
            ),
            const SizedBox(height: 6),
            Text(
              _errorMessage ?? 'Network or connection error occurred.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: subtextColor),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: () => _fetchHistory(),
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Try Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Empty View ──
  Widget _buildEmptyView(bool isDark, Color cardColor, Color textColor, Color subtextColor) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF10B981), size: 40),
            ),
            const SizedBox(height: 16),
            Text(
              'No Transactions Yet',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: textColor),
            ),
            const SizedBox(height: 6),
            Text(
              _searchQuery.isNotEmpty
                  ? 'No records match "$_searchQuery". Try a different search term.'
                  : 'Start tracking by logging an expense with text, voice, or receipt.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: subtextColor, height: 1.4),
            ),
            if (widget.onAddTapped != null && _searchQuery.isEmpty) ...[
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: widget.onAddTapped,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Record First Expense'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
