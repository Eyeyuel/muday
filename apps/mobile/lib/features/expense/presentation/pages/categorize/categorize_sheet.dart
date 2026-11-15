import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../core/constants/categories.dart';
import '../../../../../core/l10n/l10n_ext.dart';
import '../../../../../core/theme/app_colors.dart';
import '../../../../../core/theme/app_text_styles.dart';
import '../../../../../core/utils/money_utils.dart';
import '../../../../sms/domain/entities/bank_transaction.dart';
import '../../widgets/amount_chip.dart';
import '../../widgets/bank_logo.dart';

class CategorizeResult {
  const CategorizeResult({required this.category, this.note});

  final String category;
  final String? note;
}

Future<CategorizeResult?> showCategorizeSheet(
  BuildContext context,
  BankTransaction transaction, {
  int remaining = 1,
  String? initialCategory,
  String? initialNote,
  bool isEdit = false,
}) {
  return showModalBottomSheet<CategorizeResult>(
    context: context,
    isScrollControlled: true,
    isDismissible: true,
    enableDrag: true,
    backgroundColor: Theme.of(context).cardColor,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
    builder: (context) => CategorizeSheet(
      transaction: transaction,
      remaining: remaining,
      initialCategory: initialCategory,
      initialNote: initialNote,
      isEdit: isEdit,
    ),
  );
}

class CategorizeSheet extends StatefulWidget {
  const CategorizeSheet({
    super.key,
    required this.transaction,
    this.remaining = 1,
    this.initialCategory,
    this.initialNote,
    this.isEdit = false,
  });

  final BankTransaction transaction;
  final int remaining;
  final String? initialCategory;
  final String? initialNote;
  final bool isEdit;

  @override
  State<CategorizeSheet> createState() => _CategorizeSheetState();
}

class _CategorizeSheetState extends State<CategorizeSheet> {
  final _noteController = TextEditingController();
  late String _category;

  @override
  void initState() {
    super.initState();
    if (widget.initialNote != null && widget.initialNote!.isNotEmpty) {
      _noteController.text = widget.initialNote!;
    }
    final isIncome = widget.transaction.flow == TransactionFlow.received;
    if (widget.initialCategory != null &&
        widget.initialCategory!.isNotEmpty &&
        widget.initialCategory != ExpenseCategories.uncategorized) {
      _category = widget.initialCategory!;
    } else {
      _category = isIncome
          ? ExpenseCategories.otherIncome
          : ExpenseCategories.foodGroceries;
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final transaction = widget.transaction;
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final isIncome = transaction.flow == TransactionFlow.received;
    final categoryList = isIncome
        ? ExpenseCategories.incomeDefaults
        : ExpenseCategories.defaults;

    return Padding(
      padding: EdgeInsets.fromLTRB(24, 16, 24, 24 + bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Theme.of(context).dividerColor,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header Row: Count / Edit Mode on Left, Skip / Cancel button on Right
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (!widget.isEdit && widget.remaining > 1)
                Text(
                  'ofToLabel'.tr(namedArgs: {'count': widget.remaining.toString()}),
                  style: AppTextStyles.label(context),
                )
              else if (widget.isEdit)
                Row(
                  children: [
                    const Icon(
                      Icons.edit_note_rounded,
                      size: 16,
                      color: AppColors.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Edit Category',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                )
              else
                const SizedBox.shrink(),
              if (widget.isEdit)
                GestureDetector(
                  onTap: () => Navigator.of(context).pop(null),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Theme.of(context).dividerColor.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: Theme.of(context).hintColor,
                    ),
                  ),
                )
              else
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).pop(
                      const CategorizeResult(
                        category: ExpenseCategories.uncategorized,
                      ),
                    );
                  },
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Theme.of(context).dividerColor.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'skipForNow'.tr(),
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).hintColor,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.close_rounded,
                          size: 14,
                          color: Theme.of(context).hintColor,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            widget.isEdit
                ? (isIncome
                    ? 'Income of ${MoneyUtils.formatBirr(transaction.amount)}'
                    : 'Expense of ${MoneyUtils.formatBirr(transaction.amount)}')
                : (isIncome
                    ? 'Received ${MoneyUtils.formatBirr(transaction.amount)}'
                    : 'youSpent'.tr(namedArgs: {'amount': MoneyUtils.formatBirr(transaction.amount)})),
            style: AppTextStyles.title(context).copyWith(fontSize: 24),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              AmountChip(amount: transaction.amount),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    BankLogo(source: transaction.source, size: 16),
                    const SizedBox(width: 6),
                    Text(
                      transaction.sender,
                      style: AppTextStyles.body(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            widget.isEdit
                ? 'Select updated category'
                : (isIncome
                    ? 'What was this ${transaction.sender} income from?'
                    : 'whatWasThisFor'.tr(namedArgs: {'bank': transaction.sender})),
            style: AppTextStyles.body(context),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            child: Row(
              children: [
                for (final cat in categoryList) ...[
                  GestureDetector(
                    onTap: () => setState(() => _category = cat),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: _category == cat
                            ? ExpenseCategories.getColor(cat).withValues(alpha: 0.2)
                            : Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _category == cat
                              ? ExpenseCategories.getColor(cat)
                              : Theme.of(context).dividerColor.withValues(alpha: 0.4),
                          width: _category == cat ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _category == cat
                                ? Icons.check_circle_rounded
                                : ExpenseCategories.getIcon(cat),
                            size: 16,
                            color: _category == cat
                                ? ExpenseCategories.getColor(cat)
                                : Theme.of(context).hintColor,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            ExpenseCategories.getLabel(cat).toLocalizedCategory(),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: _category == cat ? FontWeight.w700 : FontWeight.w500,
                              color: _category == cat
                                  ? ExpenseCategories.getColor(cat)
                                  : Theme.of(context).colorScheme.onSurface,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _noteController,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'noteHint'.tr(),
              filled: true,
              fillColor: Theme.of(context).colorScheme.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () {
              final note = _noteController.text.trim();
              Navigator.of(context).pop(
                CategorizeResult(
                  category: _category,
                  note: note.isEmpty ? null : note,
                ),
              );
            },
            child: Text(
              widget.isEdit
                  ? 'Update Category'
                  : (isIncome ? 'Save Income' : 'saveExpense'.tr()),
            ),
          ),
        ],
      ),
    );
  }
}
