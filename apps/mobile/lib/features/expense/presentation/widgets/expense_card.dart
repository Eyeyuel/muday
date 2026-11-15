import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/l10n_ext.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/money_utils.dart';
import '../../domain/entities/expense.dart';

import 'bank_logo.dart';

class ExpenseCard extends StatelessWidget {
  const ExpenseCard({super.key, required this.expense});

  final Expense expense;

  @override
  Widget build(BuildContext context) {
    final date = DateFormat('d MMM, HH:mm').format(expense.date);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            BankLogo(
              source: expense.source,
              size: 44,
              elevation: 1,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    expense.category.toLocalizedCategory(),
                    style: AppTextStyles.section(context),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    expense.source != null
                        ? '${expense.source!.label}  ·  $date'
                        : date,
                    style: AppTextStyles.label(context),
                  ),
                ],
              ),
            ),
            Text(
              MoneyUtils.formatBirr(expense.amount),
              style: AppTextStyles.section(context),
            ),
          ],
        ),
      ),
    );
  }
}
