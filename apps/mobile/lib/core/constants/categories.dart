import 'package:flutter/material.dart';

abstract final class ExpenseCategories {
  // Expense Categories (matches backend TransactionCategory enum)
  static const foodGroceries = 'FOOD_GROCERIES';
  static const transport = 'TRANSPORT';
  static const shoppingHousehold = 'SHOPPING_HOUSEHOLD';
  static const housingRent = 'HOUSING_RENT';
  static const utilities = 'UTILITIES';
  static const airtimeInternet = 'AIRTIME_INTERNET';
  static const health = 'HEALTH';
  static const education = 'EDUCATION';
  static const entertainment = 'ENTERTAINMENT';
  static const clothingPersonalCare = 'CLOTHING_PERSONAL_CARE';
  static const churchCharityGifts = 'CHURCH_CHARITY_GIFTS';
  static const travel = 'TRAVEL';
  static const feesTaxes = 'FEES_TAXES';
  static const otherExpense = 'OTHER_EXPENSE';

  // Income Categories
  static const salary = 'SALARY';
  static const business = 'BUSINESS';
  static const freelance = 'FREELANCE';
  static const remittance = 'REMITTANCE';
  static const giftReceived = 'GIFT_RECEIVED';
  static const otherIncome = 'OTHER_INCOME';

  static const uncategorized = 'UNCATEGORIZED';

  // Default selection list for expense categorization sheet
  static const defaults = [
    foodGroceries,
    transport,
    shoppingHousehold,
    airtimeInternet,
    utilities,
    housingRent,
    entertainment,
    health,
    education,
    clothingPersonalCare,
    churchCharityGifts,
    travel,
    feesTaxes,
    otherExpense,
  ];

  static const incomeDefaults = [
    salary,
    business,
    freelance,
    remittance,
    giftReceived,
    otherIncome,
  ];

  static String getLabel(String? key) {
    if (key == null) return 'Uncategorized';
    switch (key.toUpperCase()) {
      case foodGroceries:
      case 'FOOD':
        return 'Food & Groceries';
      case transport:
      case 'TAXI':
        return 'Transport';
      case shoppingHousehold:
      case 'SHOPPING':
        return 'Shopping & Household';
      case housingRent:
      case 'RENT':
        return 'Housing & Rent';
      case utilities:
      case 'BILLS':
        return 'Utilities';
      case airtimeInternet:
      case 'AIRTIME_DATA':
        return 'Airtime & Internet';
      case health:
        return 'Health & Medical';
      case education:
        return 'Education';
      case entertainment:
        return 'Entertainment';
      case clothingPersonalCare:
      case 'CLOTHING':
        return 'Clothing & Personal';
      case churchCharityGifts:
      case 'CHURCH_CHARITY':
        return 'Church & Charity';
      case travel:
        return 'Travel';
      case feesTaxes:
        return 'Fees & Taxes';
      case otherExpense:
      case 'OTHER':
        return 'Other Expense';
      case salary:
        return 'Salary';
      case business:
        return 'Business Income';
      case freelance:
        return 'Freelance';
      case remittance:
        return 'Remittance';
      case giftReceived:
        return 'Gift Received';
      case otherIncome:
        return 'Other Income';
      default:
        // Humanize underscore strings
        return key.replaceAll('_', ' ').toLowerCase().split(' ').map((word) {
          if (word.isEmpty) return '';
          return word[0].toUpperCase() + word.substring(1);
        }).join(' ');
    }
  }

  static IconData getIcon(String? key) {
    if (key == null) return Icons.category_rounded;
    switch (key.toUpperCase()) {
      case foodGroceries:
      case 'FOOD':
      case 'COFFEE':
        return Icons.restaurant_rounded;
      case transport:
      case 'TAXI':
        return Icons.directions_car_rounded;
      case shoppingHousehold:
      case 'SHOPPING':
        return Icons.shopping_bag_rounded;
      case housingRent:
      case 'RENT':
        return Icons.home_rounded;
      case utilities:
      case 'BILLS':
        return Icons.bolt_rounded;
      case airtimeInternet:
      case 'AIRTIME_DATA':
        return Icons.wifi_rounded;
      case health:
        return Icons.local_hospital_rounded;
      case education:
        return Icons.school_rounded;
      case entertainment:
        return Icons.movie_rounded;
      case clothingPersonalCare:
      case 'CLOTHING':
        return Icons.checkroom_rounded;
      case churchCharityGifts:
      case 'CHURCH_CHARITY':
        return Icons.volunteer_activism_rounded;
      case travel:
        return Icons.flight_takeoff_rounded;
      case feesTaxes:
        return Icons.receipt_long_rounded;
      case salary:
        return Icons.payments_rounded;
      case business:
        return Icons.store_rounded;
      case freelance:
        return Icons.work_rounded;
      case remittance:
        return Icons.send_rounded;
      case giftReceived:
        return Icons.card_giftcard_rounded;
      case otherIncome:
        return Icons.account_balance_wallet_rounded;
      default:
        return Icons.category_rounded;
    }
  }

  static Color getColor(String? key) {
    if (key == null) return const Color(0xFF6B7280);
    switch (key.toUpperCase()) {
      case foodGroceries:
      case 'FOOD':
      case 'COFFEE':
        return const Color(0xFFF59E0B);
      case transport:
      case 'TAXI':
        return const Color(0xFF3B82F6);
      case shoppingHousehold:
      case 'SHOPPING':
        return const Color(0xFFEC4899);
      case housingRent:
      case 'RENT':
        return const Color(0xFF8B5CF6);
      case utilities:
      case 'BILLS':
        return const Color(0xFFF97316);
      case airtimeInternet:
      case 'AIRTIME_DATA':
        return const Color(0xFF06B6D4);
      case health:
        return const Color(0xFFEF4444);
      case education:
        return const Color(0xFF10B981);
      case entertainment:
        return const Color(0xFF6366F1);
      case clothingPersonalCare:
      case 'CLOTHING':
        return const Color(0xFFA855F7);
      case churchCharityGifts:
      case 'CHURCH_CHARITY':
        return const Color(0xFFEAB308);
      case travel:
        return const Color(0xFF14B8A6);
      case feesTaxes:
        return const Color(0xFF64748B);
      case salary:
      case business:
      case freelance:
      case remittance:
      case giftReceived:
      case otherIncome:
        return const Color(0xFF10B981);
      default:
        return const Color(0xFF6B7280);
    }
  }
}

