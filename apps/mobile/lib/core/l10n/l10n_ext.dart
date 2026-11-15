import 'package:easy_localization/easy_localization.dart';

extension CategoryL10n on String {
  String toLocalizedCategory() {
    return switch (toLowerCase().trim()) {
      'coffee' => 'categoryCoffee'.tr(),
      'food' || 'food & groceries' || 'food_groceries' => 'categoryFood'.tr(),
      'taxi' || 'transport' => 'categoryTaxi'.tr(),
      'bills' || 'utilities' => 'categoryBills'.tr(),
      'other' => 'categoryOther'.tr(),
      'uncategorized' => 'categoryUncategorized'.tr(),
      _ => this,
    };
  }
}
