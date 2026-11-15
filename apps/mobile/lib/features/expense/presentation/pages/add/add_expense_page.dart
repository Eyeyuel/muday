import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import 'package:message/core/constants/bank_senders.dart';
import 'package:message/core/constants/categories.dart';
import 'package:message/core/di/injection.dart';
import 'package:message/core/utils/app_toast.dart';
import 'package:message/features/auth/data/datasources/auth_datasource.dart';
import 'package:message/features/expense/presentation/bloc/expense/expense_bloc.dart';
import 'package:message/features/expense/presentation/bloc/expense/expense_event.dart';
import 'package:message/features/sms/presentation/bloc/sms/sms_bloc.dart';
import 'package:message/features/sms/presentation/bloc/sms/sms_event.dart';
import 'package:message/features/expense/presentation/widgets/bank_logo.dart';

class AddExpensePage extends StatefulWidget {
  const AddExpensePage({
    super.key,
    this.onSaved,
  });

  final VoidCallback? onSaved;

  @override
  State<AddExpensePage> createState() => _AddExpensePageState();
}

class _AddExpensePageState extends State<AddExpensePage> with TickerProviderStateMixin {
  late TabController _tabController;
  int _activeTabIndex = 0;

  // Text Form
  final _textController = TextEditingController();
  bool _isSavingText = false;

  // Receipt Scanner
  final ImagePicker _imagePicker = ImagePicker();
  XFile? _selectedReceiptFile;
  Uint8List? _selectedReceiptBytes;
  bool _isSavingReceipt = false;

  // Voice Note
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _recordedAudioPath;
  bool _isRecording = false;
  bool _isSavingVoice = false;
  int _recordingSeconds = 0;
  Timer? _recordingTimer;

  // Global Undo state
  bool _isUndoing = false;

  // Live parser preview state
  String _liveAmount = '';
  String _liveCategory = '';

  // Quick Expense Templates
  static const List<({String category, IconData icon, Color color, List<String> prompts})> _promptGroups = [
    (
      category: 'Dining & Food',
      icon: Icons.restaurant_rounded,
      color: Color(0xFFF59E0B),
      prompts: [
        '250 birr lunch with friends',
        '150 coffee and cake at cafe',
        '80 fast food burger snack',
      ],
    ),
    (
      category: 'Transit & Commute',
      icon: Icons.directions_car_filled_rounded,
      color: Color(0xFF3B82F6),
      prompts: [
        '50 for taxi to work',
        '120 ride from bole to megenagna',
        '300 fuel petrol station',
      ],
    ),
    (
      category: 'Household & Bills',
      icon: Icons.home_work_rounded,
      color: Color(0xFF10B981),
      prompts: [
        '1200 groceries at supermarket',
        '450 electricity and water bill',
        '200 airtime mobile card',
      ],
    ),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging || _tabController.index != _activeTabIndex) {
        setState(() => _activeTabIndex = _tabController.index);
      }
    });

    _textController.addListener(_updateLiveParser);
  }

  void _updateLiveParser() {
    final text = _textController.text.toLowerCase();
    
    // Quick regex for amount
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)\s*(?:birr|etb|br)?').firstMatch(text);
    final amt = amountMatch != null ? amountMatch.group(1) : '';

    // Quick regex for category
    String cat = '';
    if (text.contains('lunch') || text.contains('food') || text.contains('burger') || text.contains('coffee') || text.contains('dinner') || text.contains('grocer')) {
      cat = 'Food & Groceries';
    } else if (text.contains('taxi') || text.contains('ride') || text.contains('fuel') || text.contains('bus') || text.contains('transport')) {
      cat = 'Transport';
    } else if (text.contains('bill') || text.contains('electric') || text.contains('water') || text.contains('power')) {
      cat = 'Utilities';
    } else if (text.contains('airtime') || text.contains('card') || text.contains('internet') || text.contains('data')) {
      cat = 'Airtime & Internet';
    } else if (text.contains('rent') || text.contains('house')) {
      cat = 'Housing & Rent';
    } else if (text.contains('salary') || text.contains('income') || text.contains('bonus')) {
      cat = 'Income';
    }

    if (amt != _liveAmount || cat != _liveCategory) {
      setState(() {
        _liveAmount = amt ?? '';
        _liveCategory = cat;
      });
    }
  }

  @override
  void dispose() {
    _textController.removeListener(_updateLiveParser);
    _tabController.dispose();
    _textController.dispose();
    _recordingTimer?.cancel();
    _audioRecorder.dispose();
    super.dispose();
  }

  bool _isResponseSuccessful(Map<String, dynamic> result) {
    if (result['success'] == true) return true;
    if (result['success'] == false) return false;
    final status = (result['status'] as String?)?.toLowerCase();
    if (status == 'persisted' || status == 'saved' || status == 'success') return true;
    // Treat all known and unknown failure/ambiguous statuses as failures.
    // Defaulting to false prevents a silent "success" when the backend returns
    // an unrecognized body (e.g. not a receipt, unclear voice note, etc.).
    if (status == 'needs_clarification' ||
        status == 'failed' ||
        status == 'error' ||
        status == 'not_receipt' ||
        status == 'no_data' ||
        status == 'unrecognized') {
      return false;
    }
    // Ambiguous / no status field at all → treat as failure so the user sees
    // a visible red error rather than a misleading green success toast.
    return false;
  }

  String _getCategoryCodeFromLive(String liveCat) {
    switch (liveCat) {
      case 'Food & Groceries':
        return ExpenseCategories.foodGroceries;
      case 'Transport':
        return ExpenseCategories.transport;
      case 'Utilities':
        return ExpenseCategories.utilities;
      case 'Airtime & Internet':
        return ExpenseCategories.airtimeInternet;
      case 'Housing & Rent':
        return ExpenseCategories.housingRent;
      case 'Income':
        return ExpenseCategories.salary;
      default:
        return ExpenseCategories.foodGroceries;
    }
  }


  BankSource? _parseBankSource(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    final lower = raw.toLowerCase();
    for (final b in BankSource.values) {
      if (b.name.toLowerCase() == lower ||
          b.label.toLowerCase() == lower ||
          b.shortCode.toLowerCase() == lower) {
        return b;
      }
    }
    return null;
  }

  Future<bool> _showSmartMatchModal({
    required Map<String, dynamic> candidate,
    required String originalText,
    required double amount,
  }) async {
    const emeraldGreen = Color(0xFF10B981);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF141126) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF64748B);

    final targetId = candidate['id']?.toString() ?? '';
    final targetType = candidate['targetType']?.toString() ?? 'pending_interaction';
    final bankSourceStr = candidate['bankSource']?.toString();
    final bankSource = _parseBankSource(bankSourceStr);
    final bankLabel = bankSource?.label ?? (bankSourceStr != null && bankSourceStr.isNotEmpty ? bankSourceStr : 'Bank');

    final occurredAtStr = candidate['occurredAt']?.toString();
    final occurredAt = occurredAtStr != null ? DateTime.tryParse(occurredAtStr) : null;
    final formattedTime = occurredAt != null
        ? 'Today, ${DateFormat('hh:mm a').format(occurredAt.toLocal())}'
        : 'Recent SMS';

    final reference = candidate['reference']?.toString() ??
        candidate['note']?.toString() ??
        'Payment via $bankLabel';

    final result = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: cardBg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top drag handle
                Center(
                  child: Container(
                    width: 42,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF2D264B) : const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Header with Close (X) button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Matching Bank Payment Found',
                            style: TextStyle(
                              fontSize: 17.5,
                              fontWeight: FontWeight.w800,
                              color: textColor,
                              letterSpacing: -0.2,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Link your note to avoid duplicate records',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: subtextColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                    InkWell(
                      onTap: () => Navigator.of(ctx).pop(null),
                      borderRadius: BorderRadius.circular(20),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          Icons.close_rounded,
                          size: 20,
                          color: subtextColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Matching Bank Card (Emerald Border #10b981)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF181330) : const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: emeraldGreen,
                      width: 1.6,
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          BankLogo(source: bankSource, size: 40),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  bankLabel.toLowerCase().contains('telebirr')
                                      ? 'Telebirr SuperApp'
                                      : bankLabel,
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: textColor,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.access_time_rounded,
                                      size: 13,
                                      color: subtextColor,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      formattedTime,
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        color: subtextColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    'ETB ${amount.toStringAsFixed(2)}',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w900,
                                      color: textColor,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Icon(
                                    Icons.check_circle_rounded,
                                    color: emeraldGreen,
                                    size: 20,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              const Text(
                                'EXPENSE',
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFFF43F5E),
                                  letterSpacing: 0.6,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // SMS Note Pill
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF0F0B1E) : const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.receipt_long_outlined,
                              size: 14,
                              color: subtextColor,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'SMS Note: $reference',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  color: subtextColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Button 1: Link & Update Bank Payment (Emerald #10b981)
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: emeraldGreen,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.link_rounded, size: 19),
                        const SizedBox(width: 8),
                        Text(
                          'Link & Update Bank Payment ($bankLabel)',
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Button 2: No, Save as Separate New Transaction
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: OutlinedButton.styleFrom(
                      backgroundColor: isDark ? const Color(0xFF1B1533) : const Color(0xFFF8FAFC),
                      foregroundColor: textColor,
                      side: BorderSide(
                        color: isDark ? const Color(0xFF2E2657) : const Color(0xFFCBD5E1),
                        width: 1,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.add_circle_outline_rounded,
                          size: 17,
                          color: subtextColor,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'No, Save as Separate New Transaction',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: textColor,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (result == true) {
      // Execute linking
      setState(() => _isSavingText = true);
      try {
        final categoryCode = _getCategoryCodeFromLive(_liveCategory);
        final note = _textController.text.trim();
        final authDataSource = sl<AuthDataSource>();

        await authDataSource.linkCandidateTransaction(
          targetId: targetId,
          targetType: targetType,
          category: categoryCode,
          note: note.isNotEmpty ? note : null,
          type: 'expense',
        );

        if (mounted) {
          setState(() {
            _isSavingText = false;
            _textController.clear();
          });
          context.read<ExpenseBloc>().add(const ExpenseStarted());
          context.read<SmsBloc>().add(SmsTransactionHandled(targetId));

          widget.onSaved?.call();
          AppToast.expense(
            context: context,
            isSuccess: true,
            details: 'Linked & categorized with $bankLabel transaction!',
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _isSavingText = false);
          AppToast.expense(
            context: context,
            isSuccess: false,
            details: 'Could not link: ${e.toString().replaceAll('Exception: ', '')}',
          );
        }
      }
      return true;
    } else if (result == false) {
      // User tapped "Keep Separate (Cash)" -> return false to continue standard cash save
      return false;
    }

    // Modal dismissed without action
    return true;
  }

  // 1. Submit Text Expense (`POST /api/v1/transactions/text`)
  Future<void> _submitTextExpense([String? presetText]) async {
    final text = (presetText ?? _textController.text).trim();
    if (text.isEmpty) {
      AppToast.expense(
        context: context,
        isSuccess: false,
        details: 'Please type an expense note (e.g., "150 birr for lunch")',
      );
      return;
    }

    setState(() => _isSavingText = true);

    // Check for Smart Match candidate if amount is detected
    final amountMatch = RegExp(r'(\d+(?:\.\d{1,2})?)\s*(?:birr|etb|br)?', caseSensitive: false).firstMatch(text);
    final parsedAmount = double.tryParse(_liveAmount.isNotEmpty ? _liveAmount : (amountMatch?.group(1) ?? ''));

    if (parsedAmount != null && parsedAmount > 0) {
      try {
        final authDataSource = sl<AuthDataSource>();
        final candidates = await authDataSource.getMatchCandidates(parsedAmount);

        if (candidates.isNotEmpty && mounted) {
          setState(() => _isSavingText = false);
          final handled = await _showSmartMatchModal(
            candidate: candidates.first,
            originalText: text,
            amount: parsedAmount,
          );
          if (handled) return;
          setState(() => _isSavingText = true);
        }
      } catch (_) {}
    }

    try {
      final authDataSource = sl<AuthDataSource>();
      final result = await authDataSource.postTextTransaction(text);

      final isSuccess = _isResponseSuccessful(result);
      final raw = result['message'] as String? ??
          (isSuccess ? 'Expense recorded successfully!' : 'Could not understand transaction.');

      if (mounted) {
        setState(() {
          _isSavingText = false;
          if (isSuccess) _textController.clear();
        });

        if (isSuccess) widget.onSaved?.call();
        AppToast.expense(
          context: context,
          isSuccess: isSuccess,
          details: AppToast.cleanBackendMessage(raw),
          onUndo: isSuccess ? _undoLatestTransaction : null,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingText = false);
        AppToast.expense(
          context: context,
          isSuccess: false,
          details: e.toString().replaceAll('Exception: ', ''),
        );
      }
    }
  }

  // 2. Receipt Scanner: Pick, Preview & Upload
  Future<void> _showImageSourcePicker() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF141026) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280);

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
                const SizedBox(height: 18),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6C4BFF).withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.document_scanner_rounded, color: Color(0xFF8B5CF6), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Scan or Select Receipt',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: textColor,
                            letterSpacing: -0.2,
                          ),
                        ),
                        Text(
                          'Upload photo of receipt or invoice',
                          style: TextStyle(fontSize: 12.5, color: subtextColor),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          Navigator.pop(ctx);
                          _pickReceiptImage(ImageSource.camera);
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 14),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isDark
                                  ? [const Color(0xFF1E173E), const Color(0xFF16112C)]
                                  : [const Color(0xFFF3F4F8), const Color(0xFFE5E7EB)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark ? const Color(0xFF322564) : const Color(0xFFD1D5DB),
                              width: 1.2,
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF6C4BFF), Color(0xFF8B5CF6)],
                                  ),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF6C4BFF).withValues(alpha: 0.35),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 26),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Camera',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14.5,
                                  color: textColor,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Take photo',
                                style: TextStyle(fontSize: 12, color: subtextColor),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: InkWell(
                        onTap: () {
                          Navigator.pop(ctx);
                          _pickReceiptImage(ImageSource.gallery);
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 14),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: isDark
                                  ? [const Color(0xFF1E173E), const Color(0xFF16112C)]
                                  : [const Color(0xFFF3F4F8), const Color(0xFFE5E7EB)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isDark ? const Color(0xFF322564) : const Color(0xFFD1D5DB),
                              width: 1.2,
                            ),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
                                  ),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF3B82F6).withValues(alpha: 0.35),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: const Icon(Icons.photo_library_rounded, color: Colors.white, size: 26),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                'Photo Gallery',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14.5,
                                  color: textColor,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Choose image',
                                style: TextStyle(fontSize: 12, color: subtextColor),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _pickReceiptImage(ImageSource source) async {
    try {
      final XFile? file = await _imagePicker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (file != null) {
        final bytes = await file.readAsBytes();
        if (mounted) {
          setState(() {
            _selectedReceiptFile = file;
            _selectedReceiptBytes = bytes;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context: context,
          title: 'Image Error',
          description: 'Failed to pick image: ${e.toString().replaceAll('Exception: ', '')}',
        );
      }
    }
  }

  void _clearSelectedReceipt() {
    setState(() {
      _selectedReceiptFile = null;
      _selectedReceiptBytes = null;
    });
  }

  Future<void> _submitReceiptUpload([String? sampleReceiptText]) async {
    if (sampleReceiptText == null && _selectedReceiptBytes == null) {
      _showImageSourcePicker();
      return;
    }

    setState(() => _isSavingReceipt = true);

    try {
      final authDataSource = sl<AuthDataSource>();

      if (sampleReceiptText != null && sampleReceiptText.isNotEmpty) {
        final result = await authDataSource.postTextTransaction(sampleReceiptText);
        final isSuccess = _isResponseSuccessful(result);
        final raw = result['message'] as String? ??
            (isSuccess ? 'Receipt saved!' : 'Could not process receipt.');

        if (mounted) {
          setState(() => _isSavingReceipt = false);
          if (isSuccess) widget.onSaved?.call();
          AppToast.expense(
            context: context,
            isSuccess: isSuccess,
            details: AppToast.cleanBackendMessage(raw),
            onUndo: isSuccess ? _undoLatestTransaction : null,
          );
        }
        return;
      }

      final bytes = _selectedReceiptBytes!;
      final filename = _selectedReceiptFile?.name ??
          'receipt_${DateTime.now().millisecondsSinceEpoch}.jpg';

      final result = await authDataSource.uploadReceiptTransaction(bytes, filename);
      final isSuccess = _isResponseSuccessful(result);
      final raw = result['message'] as String? ?? 'Receipt processed and transaction saved!';

      if (mounted) {
        setState(() {
          _isSavingReceipt = false;
          if (isSuccess) {
            _selectedReceiptFile = null;
            _selectedReceiptBytes = null;
          }
        });
        if (isSuccess) widget.onSaved?.call();
        AppToast.expense(
          context: context,
          isSuccess: isSuccess,
          details: AppToast.cleanBackendMessage(raw),
          onUndo: isSuccess ? _undoLatestTransaction : null,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingReceipt = false);
        AppToast.expense(
          context: context,
          isSuccess: false,
          details: e.toString().replaceAll('Exception: ', ''),
        );
      }
    }
  }

  // 3. Voice Note Recording & Upload (`POST /api/v1/transactions/voice`)
  void _toggleVoiceRecording() {
    if (_isRecording) {
      _stopAndUploadVoice();
    } else {
      _startVoiceRecording();
    }
  }

  Future<void> _startVoiceRecording() async {
    try {
      // 1. Check & request microphone permission
      final hasPermission = await _audioRecorder.hasPermission();
      if (!hasPermission) {
        if (mounted) {
          AppToast.expense(
            context: context,
            isSuccess: false,
            details: 'Microphone permission is required to record voice notes. Please grant permission in device settings.',
          );
        }
        return;
      }

      // 2. Prepare temporary output path
      final tempDir = await getTemporaryDirectory();
      final filePath = '${tempDir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      _recordedAudioPath = filePath;

      // 3. Start recording AAC audio
      await _audioRecorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 128000,
          sampleRate: 44100,
        ),
        path: filePath,
      );

      if (mounted) {
        setState(() {
          _isRecording = true;
          _recordingSeconds = 0;
        });

        _recordingTimer?.cancel();
        _recordingTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (mounted) {
            setState(() {
              _recordingSeconds++;
              if (_recordingSeconds >= 60) {
                _stopAndUploadVoice();
              }
            });
          }
        });
      }
    } catch (e) {
      if (mounted) {
        AppToast.expense(
          context: context,
          isSuccess: false,
          details: 'Failed to start recording: ${e.toString().replaceAll('Exception: ', '')}',
        );
      }
    }
  }

  Future<void> _stopAndUploadVoice() async {
    _recordingTimer?.cancel();
    final duration = _recordingSeconds > 0 ? _recordingSeconds : 1;

    String? path;
    try {
      path = await _audioRecorder.stop();
    } catch (_) {}

    path ??= _recordedAudioPath;

    setState(() {
      _isRecording = false;
      _isSavingVoice = true;
    });

    try {
      if (path == null) {
        throw Exception('Audio file could not be saved.');
      }

      final file = File(path);
      if (!await file.exists()) {
        throw Exception('Recorded audio file not found.');
      }

      final audioBytes = await file.readAsBytes();
      if (audioBytes.isEmpty) {
        throw Exception('Recorded audio file is empty.');
      }

      final authDataSource = sl<AuthDataSource>();
      final filename = 'voice_${DateTime.now().millisecondsSinceEpoch}.m4a';

      final result = await authDataSource.uploadVoiceTransaction(
        audioBytes,
        filename,
        durationSeconds: duration,
      );

      final isSuccess = _isResponseSuccessful(result);
      final raw = result['message'] as String? ?? 'Voice note processed and transaction logged!';

      if (mounted) {
        setState(() => _isSavingVoice = false);
        if (isSuccess) widget.onSaved?.call();
        AppToast.expense(
          context: context,
          isSuccess: isSuccess,
          details: AppToast.cleanBackendMessage(raw),
          onUndo: isSuccess ? _undoLatestTransaction : null,
        );
      }

      // Cleanup local temp file
      try {
        if (await file.exists()) await file.delete();
      } catch (_) {}
    } catch (e) {
      if (mounted) {
        setState(() => _isSavingVoice = false);
        AppToast.expense(
          context: context,
          isSuccess: false,
          details: e.toString().replaceAll('Exception: ', ''),
        );
      }
    }
  }

  // 4. Undo Latest Transaction (`POST /api/v1/transactions/undo`)
  Future<void> _undoLatestTransaction() async {
    if (_isUndoing) return;
    setState(() => _isUndoing = true);

    try {
      final authDataSource = sl<AuthDataSource>();
      final result = await authDataSource.undoLatestTransaction();
      final msg = result['message'] as String? ?? 'Last transaction undone successfully';

      if (mounted) {
        setState(() => _isUndoing = false);
        widget.onSaved?.call();
        AppToast.undo(context: context, message: msg);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUndoing = false);
        AppToast.expense(
          context: context,
          isSuccess: false,
          details: 'Could not undo: ${e.toString().replaceAll('Exception: ', '')}',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);
    final cardBgColor = isDark ? const Color(0xFF120E24) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);

    return Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          // 1. Enterprise Zen Header Card
          _buildEnterpriseZenHeader(isDark, textColor, subtextColor),

          // 2. Segmented Mode Switcher
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 12),
            child: _buildModernModeSwitcher(isDark, subtextColor),
          ),

          // 3. Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildTextNoteTab(isDark, cardBgColor, textColor, subtextColor),
                _buildVoiceNoteTab(isDark, cardBgColor, textColor, subtextColor),
                _buildReceiptScannerTab(isDark, cardBgColor, textColor, subtextColor),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Header Widget ──
  Widget _buildEnterpriseZenHeader(bool isDark, Color textColor, Color subtextColor) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF130E29) : Colors.white,
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(28),
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
            padding: EdgeInsets.fromLTRB(20, topPad + 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Bar: Muday Brand & Add Expense Title
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
                                  color: const Color(0xFF6C4BFF),
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
                              'Personal Expense Tracker',
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

                    // Quick Action Icon
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6C4BFF).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFF6C4BFF).withValues(alpha: 0.25),
                        ),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_circle_outline_rounded, size: 14, color: Color(0xFF8B5CF6)),
                          SizedBox(width: 5),
                          Text(
                            'New Entry',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF8B5CF6),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

              const SizedBox(height: 14),

              // Title & Subtitle Banner
              Text(
                'Record Expense',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                'Enter expense details via text note, voice recording, or receipt photo.',
                style: TextStyle(
                  fontSize: 12.5,
                  color: subtextColor,
                  height: 1.35,
                ),
              ),
            ],
          ),
          );
        },
      ),
    );
  }

  // ── Mode Switcher ──
  Widget _buildModernModeSwitcher(bool isDark, Color subtextColor) {
    const primaryEmerald = Color(0xFF10B981);
    final barBg = isDark ? const Color(0xFF130E26) : const Color(0xFFEAEBF3);

    final tabs = [
      (icon: Icons.edit_note_rounded, label: 'Text', index: 0),
      (icon: Icons.mic_rounded, label: 'Voice', index: 1),
      (icon: Icons.document_scanner_rounded, label: 'Receipt', index: 2),
    ];

    return Container(
      height: 52,
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: barBg,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.04),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: tabs.map((t) {
          final isSelected = _activeTabIndex == t.index;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                _tabController.animateTo(t.index);
                setState(() => _activeTabIndex = t.index);
              },
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeInOutCubic,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [Color(0xFF10B981), Color(0xFF059669)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isSelected ? primaryEmerald : Colors.transparent,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: primaryEmerald.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      t.icon,
                      size: 18,
                      color: isSelected ? Colors.white : subtextColor,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        t.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? Colors.white : subtextColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── Tab 1: Text Note ──
  Widget _buildTextNoteTab(bool isDark, Color cardBgColor, Color textColor, Color subtextColor) {
    const primaryEmerald = Color(0xFF10B981);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Prompt Canvas Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: cardBgColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isDark ? const Color(0xFF261D4A) : const Color(0xFFE2E8F0),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Canvas Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.edit_note_rounded, color: primaryEmerald, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Expense Details',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 14,
                            color: textColor,
                          ),
                        ),
                      ],
                    ),
                    if (_textController.text.isNotEmpty)
                      GestureDetector(
                        onTap: () => _textController.clear(),
                        child: Text(
                          'Clear',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: subtextColor,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 12),

                // TextField Canvas
                TextField(
                  controller: _textController,
                  maxLines: 3,
                  style: TextStyle(fontSize: 15, color: textColor, fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    hintText: 'e.g. "250 birr lunch with friends", "50 for taxi to work", "1200 groceries"',
                    hintStyle: TextStyle(fontSize: 13.5, color: subtextColor.withValues(alpha: 0.8)),
                    filled: true,
                    fillColor: isDark ? const Color(0xFF0C091A) : const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(
                        color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide(
                        color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: const BorderSide(color: primaryEmerald, width: 1.5),
                    ),
                  ),
                ),

                // Live Preview Tag Bar
                if (_liveAmount.isNotEmpty || _liveCategory.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: primaryEmerald.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: primaryEmerald.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.visibility_outlined, color: Color(0xFFF59E0B), size: 16),
                        const SizedBox(width: 6),
                        Text(
                          'Detected: ',
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: subtextColor),
                        ),
                        if (_liveAmount.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            margin: const EdgeInsets.only(right: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '$_liveAmount ETB',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF10B981),
                              ),
                            ),
                          ),
                        if (_liveCategory.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: primaryEmerald.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              _liveCategory,
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF10B981),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],


                const SizedBox(height: 16),

                // Save Expense Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: _isSavingText ? null : () => _submitTextExpense(),
                    icon: _isSavingText
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                          )
                        : const Icon(Icons.check_circle_outline_rounded, size: 20, color: Colors.white),
                    label: Text(
                      _isSavingText ? 'Saving Expense...' : 'Save Expense',
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: Colors.white,
                        letterSpacing: 0.2,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: primaryEmerald,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 4,
                      shadowColor: primaryEmerald.withValues(alpha: 0.5),
                    ),
                  ),
                ),
              ],
            ),
          ),



          const SizedBox(height: 24),

          // ── Quick Templates ──
          Row(
            children: [
              const Icon(Icons.bolt_rounded, color: Color(0xFFF59E0B), size: 18),
              const SizedBox(width: 6),
              Text(
                'Quick Templates',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          ..._promptGroups.map((group) {
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF130E26) : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: group.color.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(group.icon, size: 14, color: group.color),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        group.category,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                          color: textColor,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: group.prompts.map((p) {
                      return InkWell(
                        onTap: _isSavingText ? null : () => _submitTextExpense(p),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E173E) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark ? const Color(0xFF2E235E) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                p,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: textColor,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Icon(Icons.arrow_forward_rounded, size: 12, color: subtextColor),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }


  // ── Tab 2: Voice Note ──
  Widget _buildVoiceNoteTab(bool isDark, Color cardBgColor, Color textColor, Color subtextColor) {
    const primaryEmerald = Color(0xFF10B981);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Voice Console
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [const Color(0xFF161033), const Color(0xFF100B26)]
                    : [Colors.white, const Color(0xFFF8FAFC)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: isDark ? const Color(0xFF261D4A) : const Color(0xFFE2E8F0),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              children: [
                Text(
                  'Tap to Speak Expense',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Supports Amharic (አማርኛ) and English natural speech',
                  style: TextStyle(fontSize: 12.5, color: subtextColor),
                ),

                const SizedBox(height: 36),

                // Pulsating Mic Button
                GestureDetector(
                  onTap: _isSavingVoice ? null : _toggleVoiceRecording,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      if (_isRecording) ...[
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 600),
                          width: 150,
                          height: 150,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                          ),
                        ),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 400),
                          width: 125,
                          height: 125,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFFEF4444).withValues(alpha: 0.22),
                          ),
                        ),
                      ],
                      Container(
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: _isRecording
                                ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
                                : [const Color(0xFF10B981), const Color(0xFF059669)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: (_isRecording ? const Color(0xFFEF4444) : primaryEmerald)
                                  .withValues(alpha: 0.45),
                              blurRadius: _isRecording ? 30 : 18,
                              spreadRadius: _isRecording ? 6 : 2,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Center(
                          child: _isSavingVoice
                              ? const SizedBox(
                                  width: 32,
                                  height: 32,
                                  child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white),
                                )
                              : Icon(
                                  _isRecording ? Icons.stop_rounded : Icons.mic_rounded,
                                  color: Colors.white,
                                  size: 44,
                                ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Digital Timer & Recording Status Indicator
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _isRecording
                          ? const Color(0xFFEF4444).withValues(alpha: 0.5)
                          : (isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0)),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_isRecording) ...[
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Text(
                        _isSavingVoice
                            ? 'Processing voice note...'
                            : _isRecording
                                ? 'Recording: 00:${_recordingSeconds.toString().padLeft(2, '0')} (Tap to Stop)'
                                : 'Tap microphone to start recording',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: _isRecording ? const Color(0xFFEF4444) : subtextColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),



          const SizedBox(height: 20),

          // Voice Guidance Cards
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF130E26) : Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.tips_and_updates_rounded, color: Color(0xFFF59E0B), size: 18),
                    const SizedBox(width: 8),
                    Text(
                      'Voice Examples',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _buildVoiceExampleTile('“I spent 350 birr on groceries at Bole supermarket”', isDark, textColor),
                _buildVoiceExampleTile('“መቶ ሃምሳ ብር ለምሳ ከጓደኞቼ ጋር ከፍያለሁ”', isDark, textColor),
                _buildVoiceExampleTile('“ሁለት መቶ ብር ለታክሲ ከቦሌ ወደ መገናኛ”', isDark, textColor),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceExampleTile(String quote, bool isDark, Color textColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 4),
            child: Icon(Icons.check_circle_outline_rounded, size: 14, color: Color(0xFF10B981)),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              quote,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
                color: textColor.withValues(alpha: 0.85),
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Tab 3: Receipt Scanner ──
  Widget _buildReceiptScannerTab(bool isDark, Color cardBgColor, Color textColor, Color subtextColor) {
    const primaryEmerald = Color(0xFF10B981);
    final hasImage = _selectedReceiptBytes != null;

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: cardBgColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isDark ? const Color(0xFF261D4A) : const Color(0xFFE2E8F0),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.05),
                  blurRadius: 20,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: hasImage
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.check_rounded, color: Color(0xFF10B981), size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Receipt Ready to Save',
                                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: textColor),
                                ),
                                Text(
                                  _selectedReceiptFile != null
                                      ? '${(_selectedReceiptBytes!.lengthInBytes / 1024).toStringAsFixed(1)} KB • ${_selectedReceiptFile!.name.split('/').last.split('\\').last}'
                                      : 'Image selected',
                                  style: TextStyle(fontSize: 12, color: subtextColor),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, size: 20),
                            color: subtextColor,
                            onPressed: _isSavingReceipt ? null : _clearSelectedReceipt,
                            tooltip: 'Cancel image',
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Image Preview
                      Container(
                        width: double.infinity,
                        constraints: const BoxConstraints(maxHeight: 260),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF3F4F6),
                          border: Border.all(
                            color: isDark ? const Color(0xFF2A2054) : const Color(0xFFE2E8F0),
                          ),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Image.memory(
                          _selectedReceiptBytes!,
                          fit: BoxFit.contain,
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Process Button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: _isSavingReceipt ? null : () => _submitReceiptUpload(),
                          icon: _isSavingReceipt
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.check_circle_outline_rounded, size: 20, color: Colors.white),
                          label: Text(
                            _isSavingReceipt ? 'Saving Receipt...' : 'Save Receipt',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryEmerald,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 4,
                            shadowColor: primaryEmerald.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Retake Button
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: OutlinedButton.icon(
                          onPressed: _isSavingReceipt ? null : _showImageSourcePicker,
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text(
                            'Retake / Choose Another',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: textColor,
                            side: BorderSide(
                              color: isDark ? const Color(0xFF322564) : const Color(0xFFCBD5E1),
                            ),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                        ),
                      ),
                    ],
                  )
                : Column(
                    children: [
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              primaryEmerald.withValues(alpha: 0.2),
                              const Color(0xFF3B82F6).withValues(alpha: 0.1),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                          border: Border.all(color: primaryEmerald.withValues(alpha: 0.4)),
                        ),
                        child: const Icon(Icons.document_scanner_rounded, color: primaryEmerald, size: 44),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Scan Receipt',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: textColor),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Take a photo or pick a receipt image to automatically record the expense.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.5, color: subtextColor, height: 1.4),
                      ),
                      const SizedBox(height: 22),

                      // Action Button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton.icon(
                          onPressed: _isSavingReceipt ? null : _showImageSourcePicker,
                          icon: const Icon(Icons.camera_alt_rounded, size: 20, color: Colors.white),
                          label: const Text(
                            'Capture or Pick Receipt',
                            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Colors.white),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: primaryEmerald,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            elevation: 4,
                            shadowColor: primaryEmerald.withValues(alpha: 0.5),
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
