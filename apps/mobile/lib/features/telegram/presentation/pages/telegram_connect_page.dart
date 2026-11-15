import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/data/datasources/auth_datasource.dart';
import '../../../expense/presentation/pages/shell/app_shell.dart';
import '../../../sms/presentation/bloc/permission/permission_cubit.dart';
import '../../../sms/presentation/bloc/permission/permission_state.dart';
import '../../../sms/presentation/pages/permission/permission_page.dart';

class TelegramConnectPage extends StatefulWidget {
  const TelegramConnectPage({
    super.key,
    this.isFirstPage = true,
  });

  /// If true, shown as initial/first page.
  /// If false, shown inside navigation drawer/settings with a back button.
  final bool isFirstPage;

  @override
  State<TelegramConnectPage> createState() => _TelegramConnectPageState();
}

class _TelegramConnectPageState extends State<TelegramConnectPage>
    with WidgetsBindingObserver {
  static const String botUsername = 'MezgebDevTestBot';

  // 0 = Onboarding / Open Bot screen, 1 = Enter 6-character Code screen
  int _currentStep = 0;

  bool _isLaunching = false;
  bool _isVerifying = false;
  String? _errorMessage;
  String? _lastCheckedClipboard;

  // 6 digit controllers and focus nodes
  final List<TextEditingController> _codeControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final c in _codeControllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _currentStep == 1) {
      _checkClipboardForCode();
    }
  }

  Future<void> _checkClipboardForCode() async {
    try {
      final data = await Clipboard.getData(Clipboard.kTextPlain);
      final text = data?.text?.trim() ?? '';
      if (text.isEmpty || text == _lastCheckedClipboard) return;

      final clean = text.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').trim();
      if (clean.length == 6) {
        _lastCheckedClipboard = text;
        if (mounted) {
          _handlePastedCode(clean);
        }
      }
    } catch (_) {}
  }

  String get _currentCode =>
      _codeControllers.map((c) => c.text.trim()).join();

  Future<void> _openTelegramBot() async {
    setState(() {
      _isLaunching = true;
      _errorMessage = null;
    });

    final Uri telegramAppUri = Uri.parse('tg://resolve?domain=$botUsername');
    final Uri telegramWebUri = Uri.parse('https://t.me/$botUsername');

    try {
      bool launched = false;
      try {
        launched = await launchUrl(
          telegramAppUri,
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {
        // Native app not installed/available, fallback to web
      }

      if (!launched) {
        await launchUrl(
          telegramWebUri,
          mode: LaunchMode.externalApplication,
        );
      }

      // Automatically switch to step 1 (enter code)
      if (mounted) {
        setState(() {
          _currentStep = 1;
        });
        _checkClipboardForCode();
        // Auto focus the first box
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted && _focusNodes[0].canRequestFocus && _currentCode.isEmpty) {
            _focusNodes[0].requestFocus();
          }
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open Telegram. Please open @MezgebDevTestBot manually.'),
            backgroundColor: Color(0xFFB42318),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLaunching = false);
      }
    }
  }

  void _onDigitChanged(int index, String value) {
    if (value.length > 1) {
      // User pasted full code into one box
      _handlePastedCode(value);
      return;
    }

    if (value.isNotEmpty) {
      if (index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
        // Automatically verify when all 6 digits entered
        if (_currentCode.length == 6) {
          _verifyPairingCode();
        }
      }
    }
  }

  void _handlePastedCode(String raw) {
    final clean = raw.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').trim();
    if (clean.isEmpty) return;

    for (int i = 0; i < 6; i++) {
      if (i < clean.length) {
        _codeControllers[i].text = clean[i];
      } else {
        _codeControllers[i].clear();
      }
    }

    if (clean.length >= 6) {
      _focusNodes[5].unfocus();
      _verifyPairingCode();
    } else {
      _focusNodes[clean.length].requestFocus();
    }
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text ?? '';
    if (text.isNotEmpty) {
      _handlePastedCode(text);
    }
  }

  Future<void> _verifyPairingCode() async {
    final code = _currentCode;
    if (code.length < 6) {
      setState(() {
        _errorMessage = 'Please enter the complete 6-character code.';
      });
      return;
    }

    setState(() {
      _isVerifying = true;
      _errorMessage = null;
    });

    try {
      final authDataSource = sl<AuthDataSource>();
      await authDataSource.exchangePairingCode(code);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Account connected successfully!'),
          backgroundColor: Color(0xFF10B981),
        ),
      );

      _navigateToApp();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() => _isVerifying = false);
      }
    }
  }

  void _navigateToApp() {
    final permissionState = context.read<PermissionCubit>().state;
    final isGranted = permissionState.status == PermissionStatus.granted;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => isGranted ? const AppShell() : const PermissionPage(),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = isDark ? const Color(0xFF0D0D11) : const Color(0xFFF8F9FC);
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final topPad = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: backgroundColor,
      body: Column(
        children: [
          // Safe Header with dynamic notch & status bar padding
          _buildSafeHeader(context, isDark, textColor, topPad),

          // Main Step Content
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _currentStep == 0
                  ? _buildStep0Onboarding(context, isDark)
                  : _buildStep1EnterCode(context, isDark),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSafeHeader(BuildContext context, bool isDark, Color textColor, double topPad) {
    final showBackButton = _currentStep == 1 || !widget.isFirstPage;

    return Container(
      padding: EdgeInsets.fromLTRB(16, topPad + 8, 16, 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF130E29) : Colors.white,
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.05),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border(
          bottom: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (showBackButton)
            IconButton(
              icon: Icon(Icons.arrow_back_ios_new_rounded, color: textColor, size: 20),
              onPressed: () {
                if (_currentStep == 1) {
                  setState(() {
                    _currentStep = 0;
                    _errorMessage = null;
                  });
                } else if (!widget.isFirstPage) {
                  Navigator.of(context).pop();
                }
              },
            )
          else
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    'assets/images/muday_logo.png',
                    width: 28,
                    height: 28,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Center(
                        child: Text('M', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'MUDAY',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: textColor,
                    letterSpacing: 0.6,
                  ),
                ),
              ],
            ),

          if (_currentStep == 1)
            TextButton.icon(
              onPressed: _openTelegramBot,
              icon: const Icon(Icons.open_in_new_rounded, size: 16, color: Color(0xFF2AABEE)),
              label: const Text(
                'Open Bot',
                style: TextStyle(
                  color: Color(0xFF2AABEE),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF2AABEE).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFF2AABEE).withValues(alpha: 0.25),
                ),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.link_rounded, size: 14, color: Color(0xFF2AABEE)),
                  SizedBox(width: 4),
                  Text(
                    'Bot Pairing',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF2AABEE),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  /// Step 0: Initial Feature Overview + "Connect with @MezgebDevTestBot"
  Widget _buildStep0Onboarding(BuildContext context, bool isDark) {
    final cardColor = isDark ? const Color(0xFF18181D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    const telegramBlue = Color(0xFF2AABEE);
    const telegramBlueDark = Color(0xFF229ED9);

    return SingleChildScrollView(
      key: const ValueKey('step0_onboarding'),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 8),

          // Muday AI + Telegram Hero Badge
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 104,
                height: 104,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.2),
                      telegramBlue.withValues(alpha: 0.25),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: telegramBlue.withValues(alpha: 0.25),
                      blurRadius: 28,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: cardColor,
                  border: Border.all(
                    color: telegramBlue.withValues(alpha: 0.5),
                    width: 2,
                  ),
                ),
                padding: const EdgeInsets.all(14),
                child: Image.asset(
                  'assets/images/muday_logo.png',
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) => const Icon(
                    Icons.account_balance_wallet_rounded,
                    size: 38,
                    color: AppColors.primary,
                  ),
                ),
              ),
              Positioned(
                bottom: 0,
                right: 4,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: telegramBlue,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.send_rounded,
                    size: 15,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          Text(
            'Muday AI Assistant',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: textColor,
              letterSpacing: -0.5,
            ),
          ),

          const SizedBox(height: 8),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: BoxDecoration(
              color: telegramBlue.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: telegramBlue.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.alternate_email_rounded,
                  size: 14,
                  color: telegramBlue,
                ),
                const SizedBox(width: 4),
                Text(
                  botUsername,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: telegramBlue,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          Text(
            'Connect with the Telegram bot to sync your account, log expenses via Voice, Image, Text, and SMS.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.4,
              color: subtextColor,
            ),
          ),

          const SizedBox(height: 24),

          // Features Container
          Container(
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: isDark ? const Color(0xFF2D2D35) : const Color(0xFFE5E7EB),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                _FeatureTile(
                  icon: Icons.text_fields_rounded,
                  iconColor: AppColors.primary,
                  title: '1. Smart Text AI Parsing',
                  subtitle: 'Type simple text (e.g., "50 for taxi") to register expenses instantly via AI.',
                  isDark: isDark,
                ),
                const Divider(height: 22),
                _FeatureTile(
                  icon: Icons.document_scanner_rounded,
                  iconColor: const Color(0xFF10B981),
                  title: '2. Image & Receipt AI OCR',
                  subtitle: 'Upload receipt photos or paid bills; AI extracts amounts, vendor names & dates.',
                  isDark: isDark,
                ),
                const Divider(height: 22),
                _FeatureTile(
                  icon: Icons.mic_rounded,
                  iconColor: const Color(0xFF8B5CF6),
                  title: '3. Voice AI Expense Recorder',
                  subtitle: 'Speak your expenses in voice notes; AI transcribes and logs them automatically.',
                  isDark: isDark,
                ),
                const Divider(height: 22),
                _FeatureTile(
                  icon: Icons.account_balance_rounded,
                  iconColor: telegramBlue,
                  title: '4. Bank SMS Extraction & Separation',
                  subtitle: 'Extract bank SMS and automatically separate transactions by bank (Telebirr, CBE, etc.).',
                  isDark: isDark,
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // Primary Button: Connect with Telegram
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _isLaunching ? null : _openTelegramBot,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.zero,
                elevation: 6,
                shadowColor: telegramBlue.withValues(alpha: 0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Ink(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [telegramBlue, telegramBlueDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Container(
                  alignment: Alignment.center,
                  child: _isLaunching
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.send_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Connect with @$botUsername',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // Secondary Button: I already have a code
          TextButton(
            onPressed: () {
              setState(() {
                _currentStep = 1;
                _errorMessage = null;
              });
              _checkClipboardForCode();
              Future.delayed(const Duration(milliseconds: 200), () {
                if (mounted && _focusNodes[0].canRequestFocus && _currentCode.isEmpty) {
                  _focusNodes[0].requestFocus();
                }
              });
            },
            child: const Text(
              'I already have a 6-character code',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: telegramBlue,
              ),
            ),
          ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }

  /// Step 1: 6-Character Code Verification Screen
  Widget _buildStep1EnterCode(BuildContext context, bool isDark) {
    final cardColor = isDark ? const Color(0xFF18181D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subtextColor = isDark ? const Color(0xFF9CA3AF) : const Color(0xFF4B5563);
    const telegramBlue = Color(0xFF2AABEE);

    return SingleChildScrollView(
      key: const ValueKey('step1_enter_code'),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 10),

          // Icon Header
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: telegramBlue.withValues(alpha: 0.12),
              border: Border.all(
                color: telegramBlue.withValues(alpha: 0.4),
                width: 2,
              ),
            ),
            child: const Icon(
              Icons.pin_rounded,
              size: 38,
              color: telegramBlue,
            ),
          ),

          const SizedBox(height: 20),

          Text(
            'Enter Pairing Code',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: textColor,
              letterSpacing: -0.5,
            ),
          ),

          const SizedBox(height: 8),

          Text(
            'Type or paste the 6-character code provided by @$botUsername in Telegram.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.4,
              color: subtextColor,
            ),
          ),

          const SizedBox(height: 32),

          // 6 Character Code Inputs
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) {
              return SizedBox(
                width: 48,
                height: 58,
                child: KeyboardListener(
                  focusNode: FocusNode(),
                  onKeyEvent: (event) {
                    if (event is KeyDownEvent &&
                        event.logicalKey == LogicalKeyboardKey.backspace &&
                        _codeControllers[index].text.isEmpty &&
                        index > 0) {
                      _focusNodes[index - 1].requestFocus();
                      _codeControllers[index - 1].clear();
                    }
                  },
                  child: TextField(
                    controller: _codeControllers[index],
                    focusNode: _focusNodes[index],
                    textAlign: TextAlign.center,
                    textCapitalization: TextCapitalization.none,
                    autocorrect: false,
                    enableSuggestions: false,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: textColor,
                      fontFamily: 'monospace',
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: cardColor,
                      contentPadding: EdgeInsets.zero,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: isDark ? const Color(0xFF33333E) : const Color(0xFFD1D5DB),
                          width: 1.5,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide(
                          color: isDark ? const Color(0xFF33333E) : const Color(0xFFD1D5DB),
                          width: 1.5,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(
                          color: telegramBlue,
                          width: 2.2,
                        ),
                      ),
                    ),
                    onChanged: (value) => _onDigitChanged(index, value),
                  ),
                ),
              );
            }),
          ),

          const SizedBox(height: 18),

          // Paste from Clipboard button
          TextButton.icon(
            onPressed: _pasteFromClipboard,
            icon: const Icon(Icons.content_paste_rounded, size: 16, color: telegramBlue),
            label: const Text(
              'Paste code from clipboard',
              style: TextStyle(
                color: telegramBlue,
                fontWeight: FontWeight.w600,
                fontSize: 13.5,
              ),
            ),
          ),

          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEE2E2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF87171)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFB91C1C), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(
                        color: Color(0xFFB91C1C),
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 32),

          // Verify Button
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: _isVerifying ? null : _verifyPairingCode,
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.zero,
                elevation: 6,
                shadowColor: AppColors.primary.withValues(alpha: 0.35),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Ink(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, Color(0xFF059669)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Container(
                  alignment: Alignment.center,
                  child: _isVerifying
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.check_circle_outline_rounded, color: Colors.white, size: 20),
                            SizedBox(width: 10),
                            Text(
                              'Verify & Connect App',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          // Helper note
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF18181D) : const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFF6B7280)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Need a code? Open @$botUsername and type /mycode to get or refresh your pairing code.',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.35,
                      color: subtextColor,
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

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.isDark,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            icon,
            size: 20,
            color: iconColor,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF1F2937),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: isDark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
