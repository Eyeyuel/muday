import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/constants/sms_limits.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/utils/money_utils.dart';
import '../../../../sms/presentation/bloc/sms/sms_bloc.dart';
import '../../../../sms/presentation/bloc/sms/sms_event.dart';
import '../../../../sms/presentation/bloc/sms/sms_state.dart';
import '../../bloc/expense/expense_bloc.dart';
import '../../bloc/expense/expense_event.dart';
import '../../bloc/expense/expense_state.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/expense_card.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: BlocBuilder<SmsBloc, SmsState>(
        builder: (context, smsState) {
          return BlocBuilder<ExpenseBloc, ExpenseState>(
            builder: (context, state) {
              return RefreshIndicator(
                color: AppColors.primary,
                onRefresh: () async {
                  context.read<ExpenseBloc>().add(const ExpenseStarted());
                  context.read<SmsBloc>().add(const SmsStarted());
                },
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  children: [
                    Text('expenses'.tr(), style: AppTextStyles.title(context)),
                    const SizedBox(height: 6),
                    Text(
                      'thisMonthFromBanks'.tr(),
                      style: AppTextStyles.body(context),
                    ),
                    const SizedBox(height: 20),
                    _MonthTotalCard(total: state.monthTotal),
                    if (smsState.status == SmsStatus.loading) ...[
                      const SizedBox(height: 12),
                      _ScanStatusCard(text: 'checkingSms'.tr(namedArgs: {'count': SmsLimits.historyMax.toString()})),
                    ],
                    const SizedBox(height: 28),
                    Text('recent'.tr(), style: AppTextStyles.section(context)),
                    const SizedBox(height: 12),
                    if (state.status == ExpenseStatus.loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (state.expenses.isEmpty)
                      const EmptyState()
                    else
                      ...state.expenses.map(
                        (expense) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: ExpenseCard(expense: expense),
                        ),
                      ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _MonthTotalCard extends StatelessWidget {
  const _MonthTotalCard({required this.total});

  final double total;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 22, 22, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'spentThisMonth'.tr(),
              style: AppTextStyles.label(context).copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(MoneyUtils.formatBirr(total), style: AppTextStyles.total(context)),
          ],
        ),
      ),
    );
  }
}

class _ScanStatusCard extends StatelessWidget {
  const _ScanStatusCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(text, style: AppTextStyles.body(context)),
            ),
          ],
        ),
      ),
    );
  }
}
