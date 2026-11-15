import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 12),
      child: Column(
        children: [
          const Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.muted),
          const SizedBox(height: 12),
          Text('noExpensesYet'.tr(), style: AppTextStyles.section(context)),
          const SizedBox(height: 6),
          Text(
            'whenBankSmsArrives'.tr(),
            style: AppTextStyles.body(context),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
