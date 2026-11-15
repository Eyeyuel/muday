import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:hive/hive.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../../core/constants/bank_senders.dart';
import '../../../../../core/constants/categories.dart';
import '../../../../../core/constants/sms_limits.dart';
import '../../../../../core/constants/sms_time_filter.dart';
import '../../../../../core/di/injection.dart';
import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/utils/money_utils.dart';
import '../../../../auth/data/datasources/auth_datasource.dart';
import 'package:message/features/expense/data/services/offline_sync_service.dart';
import '../../../../settings/presentation/cubit/settings_cubit.dart';
import '../../../../settings/presentation/pages/settings_page.dart';
import '../../../../sms/domain/entities/bank_transaction.dart';
import '../../../../sms/presentation/bloc/sms/sms_bloc.dart';
import '../../../../sms/presentation/bloc/sms/sms_event.dart';
import '../../../../sms/presentation/bloc/sms/sms_state.dart';
import '../../../domain/entities/expense.dart';
import '../../bloc/expense/expense_bloc.dart';
import '../../bloc/expense/expense_event.dart';
import '../../bloc/expense/expense_state.dart';
import '../../widgets/bank_logo.dart';
import '../../widgets/empty_state.dart';
import '../add/add_expense_page.dart';
import '../analytics/analytics_dashboard_page.dart';
import '../banks/banks_page.dart';
import '../categorize/categorize_sheet.dart';
import '../list/transaction_list_page.dart';
import '../../../../settings/presentation/pages/profile_page.dart';
import '../../../../telegram/presentation/pages/telegram_connect_page.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _selectedTabIndex = 0;
  bool _sheetOpen = false;
  String _selectedFilterKey = 'all'; // 'all', 'pending', or bank source name
  SmsTimeFilter _timeFilter = SmsTimeFilter.daily; // 'daily', 'weekly', 'monthly', 'all'
  bool _hideBalances = true; // Hidden by default for privacy
  bool _showNotificationPrompt = false;

  @override
  void initState() {
    super.initState();
    context.read<ExpenseBloc>().add(ExpenseStarted(since: _timeFilter.cutoffDate));
    context.read<SmsBloc>().add(SmsStarted(timeFilter: _timeFilter));
    _checkNotificationBanner();
  }

  void _checkNotificationBanner() {
    try {
      final box = Hive.box('settings');
      final dismissed = box.get('auth_notif_banner_dismissed', defaultValue: false) as bool;
      if (!dismissed) {
        setState(() => _showNotificationPrompt = true);
      }
    } catch (_) {}
  }

  Future<void> _enableNotificationsFromBanner() async {
    try {
      final authDataSource = sl<AuthDataSource>();
      await authDataSource.updateNotificationSettings({
        'morningReminderEnabled': true,
        'nightStatusEnabled': true,
        'weeklySummaryEnabled': true,
      });

      final box = Hive.box('settings');
      await box.put('auth_notif_banner_dismissed', true);

      if (mounted) {
        setState(() => _showNotificationPrompt = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Expanded(child: Text('Telegram morning & evening reminders enabled!')),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        );
      }
    } catch (_) {
      _dismissNotificationBanner();
    }
  }

  void _dismissNotificationBanner() {
    try {
      final box = Hive.box('settings');
      box.put('auth_notif_banner_dismissed', true);
    } catch (_) {}
    if (mounted) {
      setState(() => _showNotificationPrompt = false);
    }
  }

  void _onTimeFilterChanged(SmsTimeFilter filter) {
    setState(() {
      _timeFilter = filter;
    });
    context.read<ExpenseBloc>().add(ExpenseStarted(since: filter.cutoffDate));
    context.read<SmsBloc>().add(SmsStarted(timeFilter: filter));
  }

  Future<void> _showNext(BankTransaction transaction) async {
    if (_sheetOpen || !mounted) return;
    _sheetOpen = true;
    final remaining = context.read<SmsBloc>().state.pending.length;
    final result = await showCategorizeSheet(
      context,
      transaction,
      remaining: remaining > 0 ? remaining : 1,
    );
    _sheetOpen = false;
    if (!mounted || result == null) return;

    context.read<ExpenseBloc>().add(
      ExpenseSaved(
        Expense(
          smsId: transaction.smsId,
          amount: transaction.amount,
          category: result.category,
          source: transaction.source,
          date: transaction.date,
          note: result.note,
        ),
      ),
    );
    context.read<SmsBloc>().add(SmsTransactionHandled(transaction.smsId));
  }

  Future<void> _handleTransactionTap(_UnifiedTxItem item) async {
    if (_sheetOpen || !mounted) return;
    _sheetOpen = true;

    final bankTx = item.pendingTx ??
        BankTransaction(
          smsId: item.id,
          amount: item.amount,
          source: item.source ?? BankSource.telebirr,
          date: item.date,
          sender: item.source?.name ?? 'Manual',
          rawBody: item.expense?.note ?? '',
          flow: item.flow,
        );

    final currentCategory = item.category ?? item.expense?.category;
    final currentNote = item.expense?.note;
    final isUncategorized = currentCategory == null ||
        currentCategory.toLowerCase() == 'uncategorized' ||
        currentCategory.toUpperCase() == ExpenseCategories.uncategorized.toUpperCase();

    final remaining = context.read<SmsBloc>().state.pending.length;

    final result = await showCategorizeSheet(
      context,
      bankTx,
      remaining: remaining > 0 ? remaining : 1,
      initialCategory: !isUncategorized ? currentCategory : null,
      initialNote: currentNote,
      isEdit: !isUncategorized,
    );

    _sheetOpen = false;
    if (!mounted || result == null) return;

    context.read<ExpenseBloc>().add(
      ExpenseSaved(
        Expense(
          smsId: bankTx.smsId,
          amount: bankTx.amount,
          category: result.category,
          source: bankTx.source,
          date: bankTx.date,
          note: result.note,
        ),
      ),
    );

    if (item.isPending) {
      context.read<SmsBloc>().add(SmsTransactionHandled(bankTx.smsId));
    }
  }

  void _openBanksPage() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BanksPage(
          onSelect: (tx) {
            Navigator.of(context).pop();
            _showNext(tx);
          },
        ),
      ),
    );
  }

  void _openAnalyticsPage() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const AnalyticsDashboardPage()),
    );
  }

  void _openSettingsPage() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SettingsPage()),
    );
  }

  Future<void> _openTelegramPage() async {
    const botUsername = 'MezgebDevTestBot';
    final Uri telegramAppUri = Uri.parse('tg://resolve?domain=$botUsername');
    final Uri telegramWebUri = Uri.parse('https://t.me/$botUsername');

    try {
      bool launched = false;
      try {
        launched = await launchUrl(
          telegramAppUri,
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {}

      if (!launched) {
        await launchUrl(
          telegramWebUri,
          mode: LaunchMode.externalApplication,
        );
      }
    } catch (_) {
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => const TelegramConnectPage(isFirstPage: false),
          ),
        );
      }
    }
  }



  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final darkCanvas = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);

    return MultiBlocListener(
      listeners: [
        BlocListener<SmsBloc, SmsState>(
          listenWhen: (previous, current) =>
              current.promptIncoming &&
              current.current != null &&
              previous.current?.smsId != current.current?.smsId,
          listener: (context, state) {
            final current = state.current;
            if (current != null) _showNext(current);
          },
        ),
        BlocListener<ExpenseBloc, ExpenseState>(
          listenWhen: (previous, current) =>
              current.status == ExpenseStatus.failure &&
              current.message != null,
          listener: (context, state) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(state.message!)));
          },
        ),
        BlocListener<SmsBloc, SmsState>(
          listenWhen: (previous, current) =>
              current.status == SmsStatus.failure && current.message != null,
          listener: (context, state) {
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(state.message!)));
          },
        ),
      ],
      child: Scaffold(
        backgroundColor: darkCanvas,
        body: IndexedStack(
          index: _selectedTabIndex,
          children: [
            // Tab 0: Home Dashboard
            BlocBuilder<SmsBloc, SmsState>(
              builder: (context, smsState) {
                return BlocBuilder<ExpenseBloc, ExpenseState>(
                  builder: (context, expenseState) {
                    // Build unified real extracted transaction list from bank SMS & categorized expenses
                    final allItems = <_UnifiedTxItem>[];
                    final seenIds = <String>{};

                    // Real categorized expenses from backend database
                    for (final expense in expenseState.expenses) {
                      if (!expense.smsId.startsWith('manual_') && !expense.smsId.startsWith('ai_')) {
                        seenIds.add(expense.smsId);
                        allItems.add(
                          _UnifiedTxItem(
                            id: expense.smsId,
                            amount: expense.amount,
                            source: expense.source,
                            date: expense.date,
                            category: expense.category,
                            isPending: false,
                            flow: TransactionFlow.sent,
                            expense: expense,
                          ),
                        );
                      }
                    }

                    // Scanned pending SMS (only add if NOT already loaded from backend)
                    for (final pending in smsState.pending) {
                      if (!pending.smsId.startsWith('manual_') && !pending.smsId.startsWith('ai_')) {
                        final alreadyExists = seenIds.contains(pending.smsId) ||
                            allItems.any((item) =>
                                item.source == pending.source &&
                                (item.amount - pending.amount).abs() < 0.01 &&
                                item.date.difference(pending.date).abs().inMinutes < 5);

                        if (!alreadyExists) {
                          seenIds.add(pending.smsId);
                          allItems.add(
                            _UnifiedTxItem(
                              id: pending.smsId,
                              amount: pending.amount,
                              source: pending.source,
                              date: pending.date,
                              category: null,
                              isPending: true,
                              flow: pending.flow,
                              pendingTx: pending,
                            ),
                          );
                        }
                      }
                    }

                    // Sort newest date first
                    allItems.sort((a, b) => b.date.compareTo(a.date));

                    // Filter by selected time period (Daily, Weekly, Monthly, All)
                    final cutoff = _timeFilter.cutoffDate;
                    final timeFiltered = cutoff == null
                        ? allItems
                        : allItems.where((item) => !item.date.isBefore(cutoff)).toList();

                    // Uncategorized count is scoped to the current time window.
                    // On Daily → only today's uncategorized items count.
                    // Badge, chip, and list are all consistent with each other.
                    final actualUncategorizedCount = timeFiltered.where((i) => i.isUncategorized).length;

                    final isUncategorizedFilter =
                        _selectedFilterKey == 'pending' || _selectedFilterKey == 'uncategorized';

                    // Apply active bank/uncategorized filter safely (fallback to 'all' if filter has 0 items)
                    final hasFilterMatch = timeFiltered.any((item) {
                      if (_selectedFilterKey == 'all') return true;
                      if (isUncategorizedFilter) return item.isUncategorized;
                      return item.source?.name == _selectedFilterKey;
                    });
                    final activeFilter = hasFilterMatch ? _selectedFilterKey : 'all';

                    // All three sources (badge, chip, list) use timeFiltered so Daily/Weekly/Monthly
                    // are fully respected. No cross-date leaking.
                    final filteredItems = timeFiltered.where((item) {
                      if (activeFilter == 'all') return true;
                      if (activeFilter == 'pending' || activeFilter == 'uncategorized') {
                        return item.isUncategorized;
                      }
                      return item.source?.name == activeFilter;
                    }).toList();

                    // Calculate persistent total balance across all known bank accounts / wallets
                    final totalBankBalance = smsState.latestBalanceByBank.values.fold(
                      0.0,
                      (sum, bal) => sum + bal,
                    );
                    final totalAllPending = allItems.where((i) => i.isPending).fold(
                      0.0,
                      (sum, item) => sum + item.amount,
                    );
                    final totalBalance = totalBankBalance > 0
                        ? totalBankBalance
                        : (expenseState.monthTotal + totalAllPending);

                    return Column(
                      children: [
                        // Fixed Top Card (Zen Header Card - Pinned at top)
                        _ZenTopCard(
                          totalSpent: totalBalance,
                          smsState: smsState,
                          expenseState: expenseState,
                          hideBalances: _hideBalances,
                          onToggleHideBalances: () {
                            setState(() {
                              _hideBalances = !_hideBalances;
                            });
                          },
                          onOpenBanks: _openBanksPage,
                          onOpenAnalytics: _openAnalyticsPage,
                          onOpenSettings: _openSettingsPage,
                          onOpenTelegram: _openTelegramPage,
                          onSelectBankFilter: (bankName) {
                            setState(() {
                              _selectedFilterKey = bankName;
                            });
                          },
                        ),

                        // Fixed Middle Floating Dark Action Bar (Pinned)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 12,
                          ),
                          child: _ZenActionBar(
                            // Always show all-time uncategorized count — this is a
                            // persistent indicator of items still needing a category,
                            // not limited to the current time filter window.
                            pendingCount: actualUncategorizedCount,
                            isLoading: smsState.status == SmsStatus.loading ||
                                smsState.isScanning,
                            onScan: () {
                              sl<OfflineSyncService>().flushQueue().ignore();
                              context.read<SmsBloc>().add(SmsStarted(timeFilter: _timeFilter));
                              context.read<ExpenseBloc>().add(const ExpenseStarted());
                            },
                            onBanks: () {
                              setState(() {
                                if (_selectedFilterKey == 'uncategorized' || _selectedFilterKey == 'pending') {
                                  _selectedFilterKey = 'all';
                                } else {
                                  _selectedFilterKey = 'uncategorized';
                                  // Do NOT switch the time filter — the list already reads
                                  // from allItems for uncategorized, so the Daily/Weekly chip
                                  // stays on whatever the user set.
                                }
                              });
                            },
                            onAdd: () => setState(() => _selectedTabIndex = 1),
                          ),
                        ),

                        // Notification & Daily Reminders Prompt Banner
                        if (_showNotificationPrompt)
                          _buildNotificationBanner(isDark),

                        // ONLY the Bottom Transactions Section is Scrollable!
                        Expanded(
                          child: _ZenTransactionsSheet(
                            items: filteredItems,
                            allTimeFilteredItems: timeFiltered,
                            // Use all-time count for the chip so it's consistent with
                            // the action bar badge and never hides when filter is narrow.
                            pendingCount: actualUncategorizedCount,
                            isLoading: smsState.status == SmsStatus.loading ||
                                smsState.isScanning,
                            scannedCount: smsState.scannedCount,
                            selectedFilterKey: activeFilter,
                            selectedTimeFilter: _timeFilter,
                            onSelectTimeFilter: _onTimeFilterChanged,
                            onRefresh: () async {
                              sl<OfflineSyncService>().flushQueue().ignore();
                              context.read<ExpenseBloc>().add(const ExpenseStarted());
                              context.read<SmsBloc>().add(SmsStarted(timeFilter: _timeFilter));
                            },
                            onSelectFilter: (key) {
                              setState(() {
                                _selectedFilterKey = key;
                                // Do NOT auto-switch the time filter chip when selecting
                                // Uncategorized — the filtered list bypasses the time window
                                // silently by reading from allItems directly.
                              });
                            },
                            onTapItem: _handleTransactionTap,
                            onViewAll: () => setState(() => _selectedTabIndex = 2),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            ),

            // Tab 1: Add Expense
            const AddExpensePage(),

            // Tab 2: Transaction History / List
            TransactionListPage(
              isActive: _selectedTabIndex == 2,
              onAddTapped: () {
                setState(() => _selectedTabIndex = 1);
              },
            ),

            // Tab 3: Profile & Settings
            const ProfilePage(),
          ],
        ),
        extendBody: true,
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 0, 28, 16),
            child: _FloatingPillNavigationBar(
              selectedIndex: _selectedTabIndex,
              onDestinationSelected: (index) {
                setState(() => _selectedTabIndex = index);
              },
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationBanner(bool isDark) {
    const primaryEmerald = Color(0xFF10B981);
    final cardBg = isDark ? const Color(0xFF161033) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: primaryEmerald.withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: primaryEmerald.withValues(alpha: isDark ? 0.2 : 0.08),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFF059669)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: primaryEmerald.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Daily Financial Reminders',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Get automated morning expense alerts & 9:00 PM nightly review summaries via Telegram.',
                      style: TextStyle(fontSize: 12, color: subtextColor, height: 1.3),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                color: subtextColor,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: _dismissNotificationBanner,
                tooltip: 'Dismiss',
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 38,
                  child: ElevatedButton(
                    onPressed: _enableNotificationsFromBanner,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryEmerald,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 2,
                    ),
                    child: const Text(
                      'Enable Reminders',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 12.5,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                height: 38,
                child: TextButton(
                  onPressed: _dismissNotificationBanner,
                  child: Text(
                    'Maybe Later',
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: subtextColor,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FloatingPillNavigationBar extends StatelessWidget {
  const _FloatingPillNavigationBar({
    required this.selectedIndex,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;

  static const List<({IconData icon, IconData activeIcon, String label})> _items = [
    (icon: Icons.home_outlined, activeIcon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.add_circle_outline_rounded, activeIcon: Icons.add_circle_rounded, label: 'Add'),
    (icon: Icons.receipt_long_outlined, activeIcon: Icons.receipt_long_rounded, label: 'History'),
    (icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    const barBgColor = Color(0xFF0F0B24);
    const activePillColor = Color(0xFF10B981);

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: barBgColor,
        borderRadius: BorderRadius.circular(36),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 10),
            spreadRadius: 2,
          ),
          BoxShadow(
            color: activePillColor.withValues(alpha: 0.18),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.08),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(_items.length, (index) {
          final isSelected = selectedIndex == index;
          final item = _items[index];

          return GestureDetector(
            onTap: () => onDestinationSelected(index),
            behavior: HitTestBehavior.opaque,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOutCubic,
              padding: EdgeInsets.symmetric(
                horizontal: isSelected ? 16 : 12,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: isSelected ? activePillColor : Colors.transparent,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isSelected ? item.activeIcon : item.icon,
                    size: 21,
                    color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.55),
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 8),
                    Text(
                      item.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _UnifiedTxItem {
  const _UnifiedTxItem({
    required this.id,
    required this.amount,
    this.source,
    required this.date,
    required this.category,
    required this.isPending,
    this.flow = TransactionFlow.sent,
    this.pendingTx,
    this.expense,
  });

  final String id;
  final double amount;
  final BankSource? source;
  final DateTime date;
  final String? category;
  final bool isPending;
  final TransactionFlow flow;
  final BankTransaction? pendingTx;
  final Expense? expense;

  bool get isUncategorized {
    if (isPending) return true;
    final cat = category?.trim().toLowerCase();
    return cat == null || cat.isEmpty || cat == 'uncategorized';
  }
}

class _ZenTopCard extends StatelessWidget {
  const _ZenTopCard({
    required this.totalSpent,
    required this.smsState,
    required this.expenseState,
    required this.hideBalances,
    required this.onToggleHideBalances,
    required this.onOpenBanks,
    required this.onOpenAnalytics,
    required this.onOpenSettings,
    required this.onOpenTelegram,
    required this.onSelectBankFilter,
  });

  final double totalSpent;
  final SmsState smsState;
  final ExpenseState expenseState;
  final bool hideBalances;
  final VoidCallback onToggleHideBalances;
  final VoidCallback onOpenBanks;
  final VoidCallback onOpenAnalytics;
  final VoidCallback onOpenSettings;
  final VoidCallback onOpenTelegram;
  final ValueChanged<String> onSelectBankFilter;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF130E29) : Colors.white;
    final onSurface = isDark ? Colors.white : const Color(0xFF0F172A);

    final bankVolumes = <BankSource, double>{};
    final bankTxCounts = <BankSource, int>{};

    for (final exp in expenseState.expenses) {
      if (exp.source != null) {
        bankVolumes[exp.source!] = (bankVolumes[exp.source!] ?? 0.0) + exp.amount;
        bankTxCounts[exp.source!] = (bankTxCounts[exp.source!] ?? 0) + 1;
      }
    }

    for (final pending in smsState.pending) {
      bankVolumes[pending.source] = (bankVolumes[pending.source] ?? 0.0) + pending.amount;
      bankTxCounts[pending.source] = (bankTxCounts[pending.source] ?? 0) + 1;
    }

    // Combine all banks that have either a known balance or transaction activity
    final activeBanks = <BankSource>{
      ...smsState.latestBalanceByBank.keys,
      ...bankVolumes.keys,
    }.toList();

    activeBanks.sort((a, b) {
      final balA = smsState.latestBalanceByBank[a] ?? 0.0;
      final balB = smsState.latestBalanceByBank[b] ?? 0.0;
      if (balB != balA) {
        return balB.compareTo(balA);
      }
      final volA = bankVolumes[a] ?? 0.0;
      final volB = bankVolumes[b] ?? 0.0;
      return volB.compareTo(volA);
    });

    final cardChildren = <Widget>[];

    final displayedBanks = activeBanks.take(2).toList();
    final otherBanksCount = activeBanks.length > 2
        ? activeBanks.length - 2
        : 0;

    for (var i = 0; i < displayedBanks.length; i++) {
      final bank = displayedBanks[i];
      final latestBal = smsState.latestBalanceByBank[bank];

      cardChildren.add(
        _MiniFeatureCard(
          icon: BankLogo(
            source: bank,
            size: 18,
            showBorder: false,
          ),
          title: bank.label,
          amount: hideBalances
              ? '********'
              : (latestBal != null
                  ? MoneyUtils.formatBirr(latestBal)
                  : 'ETB 0.00'),
          onTap: () => onSelectBankFilter(bank.name),
        ),
      );
      if (i < displayedBanks.length - 1 || otherBanksCount > 0) {
        cardChildren.add(const SizedBox(width: 10));
      }
    }

    // Only show "All Banks" card if there are more than 2 banks, or if no bank is detected yet
    if (otherBanksCount > 0 || activeBanks.isEmpty) {
      cardChildren.add(
        _MiniFeatureCard(
          icon: const Icon(
            Icons.account_balance_wallet_outlined,
            size: 16,
            color: AppColors.primary,
          ),
          title: 'All Banks',
          amount: otherBanksCount > 0
              ? '+$otherBanksCount bank${otherBanksCount == 1 ? '' : 's'}'
              : '0 bank',
          showArrow: true,
          onTap: onOpenBanks,
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(32),
        ),
        border: Border(
          bottom: BorderSide(
            color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
            width: 1.2,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Padding(
          padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 8, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Bar: ZEN / Brand Logo + Action Icons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.asset(
                          'assets/images/muday_logo.png',
                          width: 30,
                          height: 30,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) {
                            return Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.primary.withValues(alpha: 0.15),
                              ),
                              child: const Center(
                                child: Icon(
                                  Icons.auto_awesome,
                                  color: AppColors.primary,
                                  size: 16,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Mudaye',
                        style: TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2.2,
                          color: onSurface,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      _ZenIconButton(
                        icon: Icons.send_rounded,
                        onTap: onOpenTelegram,
                      ),
                      const SizedBox(width: 8),
                      const _LanguageSelectorButton(),
                      const SizedBox(width: 8),
                      _ZenIconButton(
                        icon: Icons.bar_chart_rounded,
                        onTap: onOpenAnalytics,
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Balance Header Row with Eye Toggle Icon
              Row(
                children: [
                  Text(
                    'balance'.tr(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).hintColor,
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: onToggleHideBalances,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.all(2.0),
                      child: Icon(
                        hideBalances
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        size: 17,
                        color: Theme.of(context).hintColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),

              // Big Total Amount
              Text(
                hideBalances ? 'ETB ******' : MoneyUtils.formatBirr(totalSpent),
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  letterSpacing: hideBalances ? 1.0 : -0.8,
                  color: onSurface,
                ),
              ),
              const SizedBox(height: 16),

              // Horizontal Mini Cards Carousel
              SizedBox(
                height: 94,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  clipBehavior: Clip.none,
                  children: cardChildren,
                ),
              ),
            ],
          ),
        ),
      );
  }
}

class _ZenIconButton extends StatelessWidget {
  const _ZenIconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF26262B) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.3),
          ),
        ),
        child: Icon(
          icon,
          size: 18,
          color: Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}

class _LanguageSelectorButton extends StatelessWidget {
  const _LanguageSelectorButton();

  String _labelForCode(String code) {
    return switch (code) {
      'am' => 'አማ',
      _ => 'EN',
    };
  }

  void _showLanguageMenu(BuildContext context) {
    final currentLocale = context.locale;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final options = [
      (const Locale('en'), 'english'.tr(), 'English'),
      (const Locale('am'), 'amharic'.tr(), 'አማርኛ'),
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1C1C1E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'language'.tr(),
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                for (final opt in options) ...[
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    tileColor: currentLocale.languageCode == opt.$1.languageCode
                        ? AppColors.primary.withValues(alpha: 0.12)
                        : Colors.transparent,
                    leading: Icon(
                      Icons.language_rounded,
                      color: currentLocale.languageCode == opt.$1.languageCode
                          ? AppColors.primary
                          : Theme.of(context).hintColor,
                      size: 20,
                    ),
                    title: Text(
                      '${opt.$2} (${opt.$3})',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: currentLocale.languageCode == opt.$1.languageCode
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: currentLocale.languageCode == opt.$1.languageCode
                            ? AppColors.primary
                            : Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    trailing: currentLocale.languageCode == opt.$1.languageCode
                        ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20)
                        : null,
                    onTap: () async {
                      await context.setLocale(opt.$1);
                      if (context.mounted) {
                        context.read<SettingsCubit>().setLocale(opt.$1);
                        Navigator.of(ctx).pop();
                      }
                    },
                  ),
                  const SizedBox(height: 4),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentLocale = context.locale;
    final langCode = currentLocale.languageCode;

    return GestureDetector(
      onTap: () => _showLanguageMenu(context),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF26262B) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(11),
          border: Border.all(
            color: Theme.of(context).dividerColor.withValues(alpha: 0.3),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.language_rounded,
              size: 16,
              color: AppColors.primary,
            ),
            const SizedBox(width: 5),
            Text(
              _labelForCode(langCode),
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
            const SizedBox(width: 3),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 15,
              color: Theme.of(context).hintColor,
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniFeatureCard extends StatelessWidget {
  const _MiniFeatureCard({
    required this.icon,
    required this.title,
    required this.amount,
    this.showArrow = false,
    required this.onTap,
  });

  final Widget icon;
  final String title;
  final String amount;
  final bool showArrow;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC);
    final borderColor = isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 130,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: cardBg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: borderColor,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                icon,
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    title,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    amount,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (showArrow)
                  const Icon(
                    Icons.arrow_forward_rounded,
                    size: 15,
                    color: AppColors.primary,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ZenActionBar extends StatelessWidget {
  const _ZenActionBar({
    required this.pendingCount,
    required this.isLoading,
    required this.onScan,
    required this.onBanks,
    required this.onAdd,
  });

  final int pendingCount;
  final bool isLoading;
  final VoidCallback onScan;
  final VoidCallback onBanks;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF130E29) : const Color(0xFF1C1C1E),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isDark ? const Color(0xFF261D4A) : Colors.white.withValues(alpha: 0.12),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: _ActionPillButton(
              icon: isLoading ? Icons.sync : Icons.refresh_rounded,
              label: 'scan'.tr(),
              onTap: onScan,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            flex: 9,
            child: _ActionPillButton(
              icon: Icons.account_balance_wallet_rounded,
              label: 'categoryUncategorized'.tr(),
              badgeCount: pendingCount,
              onTap: onBanks,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            flex: 4,
            child: _ActionPillButton(
              icon: Icons.add_rounded,
              label: 'add'.tr(),
              onTap: onAdd,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionPillButton extends StatelessWidget {
  const _ActionPillButton({
    required this.icon,
    required this.label,
    this.badgeCount = 0,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int badgeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 9),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E173E) : const Color(0xFF2C2C2E),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 14,
              color: Colors.white,
            ),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12.0,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (badgeCount > 0) ...[
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 5,
                  vertical: 1,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$badgeCount',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ZenTransactionsSheet extends StatelessWidget {
  const _ZenTransactionsSheet({
    required this.items,
    required this.allTimeFilteredItems,
    required this.pendingCount,
    required this.isLoading,
    this.scannedCount = 0,
    required this.selectedFilterKey,
    required this.selectedTimeFilter,
    required this.onSelectTimeFilter,
    required this.onRefresh,
    required this.onSelectFilter,
    required this.onTapItem,
    required this.onViewAll,
  });

  final List<_UnifiedTxItem> items;
  final List<_UnifiedTxItem> allTimeFilteredItems;
  final int pendingCount;
  final bool isLoading;
  final int scannedCount;
  final String selectedFilterKey;
  final SmsTimeFilter selectedTimeFilter;
  final ValueChanged<SmsTimeFilter> onSelectTimeFilter;
  final RefreshCallback onRefresh;
  final ValueChanged<String> onSelectFilter;
  final ValueChanged<_UnifiedTxItem> onTapItem;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF130E29) : Colors.white;
    final onSurface = isDark ? Colors.white : const Color(0xFF0F172A);

    // Dynamically calculate which banks have transactions in this period
    final bankCounts = <BankSource, int>{};
    for (final item in allTimeFilteredItems) {
      if (item.source != null) {
        bankCounts[item.source!] = (bankCounts[item.source!] ?? 0) + 1;
      }
    }

    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(32),
        ),
        border: Border(
          top: BorderSide(
            color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
            width: 1.2,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row: "Transactions"
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
            child: Text(
              'transactions'.tr(),
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: onSurface,
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Time Period Filter: Daily · Weekly · Monthly · All
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
            child: Container(
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                children: SmsTimeFilter.values.map((filter) {
                  final isSelected = selectedTimeFilter == filter;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => onSelectTimeFilter(filter),
                      behavior: HitTestBehavior.opaque,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFF10B981)
                              : Colors.transparent,
                          borderRadius: BorderRadius.circular(13),
                          boxShadow: isSelected
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.35),
                                    blurRadius: 6,
                                    offset: const Offset(0, 2),
                                  ),
                                ]
                              : null,
                        ),
                        child: Text(
                          filter.localizedLabel,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected
                                ? Colors.white
                                : (isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B)),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Dynamic Filter Chips Row (Only shows banks that actually have transactions!)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            clipBehavior: Clip.none,
            child: Row(
              children: [
                _FilterPill(
                  label: '${'all'.tr()} (${allTimeFilteredItems.length})',
                  isSelected: selectedFilterKey == 'all',
                  onTap: () => onSelectFilter('all'),
                ),
                if (pendingCount > 0) ...[
                  const SizedBox(width: 8),
                  _FilterPill(
                    label: '${'categoryUncategorized'.tr()} ($pendingCount)',
                    isSelected: selectedFilterKey == 'uncategorized' || selectedFilterKey == 'pending',
                    onTap: () => onSelectFilter('uncategorized'),
                  ),
                ],
                ...bankCounts.entries.map((entry) {
                  final bank = entry.key;
                  final count = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: _FilterPill(
                      label: '${bank.label} ($count)',
                      logo: BankLogo(
                        source: bank,
                        size: 16,
                        showBorder: false,
                      ),
                      isSelected: selectedFilterKey == bank.name,
                      onTap: () => onSelectFilter(bank.name),
                    ),
                  );
                }),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Unified Transaction List / Empty State
          Expanded(
            child: RefreshIndicator(
              onRefresh: onRefresh,
              color: AppColors.primary,
              child: items.isEmpty && !isLoading
                  ? const Center(child: EmptyState())
                  : ListView.separated(
                      key: const PageStorageKey('home_tx_list'),
                      physics: const AlwaysScrollableScrollPhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 100),
                      itemCount: items.length + (isLoading ? 1 : 0),
                      separatorBuilder: (_, _) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        if (isLoading && index == 0) {
                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(
                              children: [
                                const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    scannedCount > 0
                                        ? 'Scanning SMS ($scannedCount / ${SmsLimits.historyMax} checked)...'
                                        : 'Scanning SMS inbox (${SmsLimits.historyMax} max)...',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: onSurface,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }

                        final itemIndex = isLoading ? index - 1 : index;
                        final item = items[itemIndex];
                        return _ZenUnifiedTile(
                          item: item,
                          onTap: () => onTapItem(item),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    this.logo,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final Widget? logo;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF10B981)
              : (isDark ? const Color(0xFF0C091A) : const Color(0xFFF1F5F9)),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF059669)
                : (isDark
                    ? const Color(0xFF231A47)
                    : const Color(0xFFE2E8F0)),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (logo != null) ...[
              logo!,
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected
                    ? Colors.white
                    : (isDark ? const Color(0xFFE2E8F0) : const Color(0xFF0F172A)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ZenUnifiedTile extends StatelessWidget {
  const _ZenUnifiedTile({
    required this.item,
    required this.onTap,
  });

  final _UnifiedTxItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final date = DateFormat("d MMM, HH:mm").format(item.date);
    final title = item.isUncategorized
        ? 'categoryUncategorized'.tr()
        : ExpenseCategories.getLabel(item.category).toLocalizedCategory();

    final isReceived = item.flow == TransactionFlow.received;
    final amountPrefix = isReceived ? '+' : '-';
    final amountColor = isReceived
        ? const Color(0xFF10B981)
        : (isDark ? const Color(0xFFF87171) : const Color(0xFFEF4444));

    final arrowIcon = isReceived
        ? Icons.south_west_rounded
        : Icons.north_east_rounded;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isDark
                ? const Color(0xFF231A47)
                : const Color(0xFFE2E8F0),
          ),
        ),
        child: Row(
          children: [
            BankLogo(
              source: item.source,
              size: 38,
              elevation: 1,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (item.isUncategorized) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1.5,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            'label'.tr(),
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.source != null
                        ? '${item.source!.label} · $date'
                        : date,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: Theme.of(context).hintColor,
                    ),
                  ),
                ],
              ),
            ),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  arrowIcon,
                  size: 13,
                  color: amountColor,
                ),
                const SizedBox(width: 3),
                Text(
                  '$amountPrefix${MoneyUtils.formatBirr(item.amount)}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: amountColor,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
