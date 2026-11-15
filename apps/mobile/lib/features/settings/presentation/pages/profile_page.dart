import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/di/injection.dart';
import '../../../auth/data/datasources/auth_datasource.dart';
import '../../../telegram/presentation/pages/telegram_connect_page.dart';
import '../../presentation/cubit/settings_cubit.dart';
import '../../presentation/cubit/settings_state.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  static const String botUsername = 'MezgebDevTestBot';

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _isLoadingProfile = true;
  String _displayName = 'Muday User';
  String? _username;
  String? _telegramId;
  String? _verifiedAt;
  String _accountStatus = 'ACTIVE';

  // Notification Settings State
  bool _morningReminderEnabled = true;
  String _morningReminderTime = '08:00';
  bool _nightStatusEnabled = true;
  String _nightStatusTime = '21:00';
  bool _weeklySummaryEnabled = true;
  bool _monthlySummaryEnabled = true;
  String? _expectedUpdatedAt;
  bool _isUpdatingNotifications = false;

  @override
  void initState() {
    super.initState();
    _fetchUserProfile();
  }

  Future<void> _fetchUserProfile() async {
    try {
      final authDataSource = sl<AuthDataSource>();

      // 1. Fetch identities from /api/v1/me/identities
      final identities = await authDataSource.getIdentities();

      // 2. Fetch me profile from /api/v1/me
      Map<String, dynamic>? meProfile;
      try {
        meProfile = await authDataSource.getMeProfile();
      } catch (_) {}

      // 3. Fetch notification settings from /api/v1/me/settings/notifications
      Map<String, dynamic>? notifSettings;
      try {
        notifSettings = await authDataSource.getNotificationSettings();
      } catch (_) {}

      if (mounted) {
        setState(() {
          if (identities.isNotEmpty) {
            final tg = identities.firstWhere(
              (id) => (id['provider'] as String?)?.toLowerCase() == 'telegram',
              orElse: () => identities.first,
            );

            _displayName = (tg['profileDisplayName'] as String?)?.trim() ?? '';
            _username = tg['profileUsername'] as String?;
            _telegramId = tg['providerSubject'] as String?;
            _verifiedAt = tg['verifiedAt'] as String?;
          }

          if (_displayName.isEmpty && meProfile != null) {
            final first = meProfile['firstName'] as String? ?? '';
            final last = meProfile['lastName'] as String? ?? '';
            final combined = '$first $last'.trim();
            _displayName = combined.isNotEmpty ? combined : (meProfile['username'] as String? ?? 'Muday User');
            _username ??= meProfile['username'] as String?;
            _accountStatus = meProfile['status'] as String? ?? 'ACTIVE';
          }

          if (_displayName.isEmpty) {
            _displayName = 'Muday User';
          }

          if (notifSettings != null) {
            _morningReminderEnabled = notifSettings['morningReminderEnabled'] as bool? ?? true;
            _morningReminderTime = notifSettings['morningReminderTime'] as String? ?? '08:00';
            _nightStatusEnabled = notifSettings['nightStatusEnabled'] as bool? ?? true;
            _nightStatusTime = notifSettings['nightStatusTime'] as String? ?? '21:00';
            _weeklySummaryEnabled = notifSettings['weeklySummaryEnabled'] as bool? ?? true;
            _monthlySummaryEnabled = notifSettings['monthlySummaryEnabled'] as bool? ?? true;
            _expectedUpdatedAt = notifSettings['updatedAt'] as String?;
          }

          _isLoadingProfile = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingProfile = false);
      }
    }
  }

  Future<void> _updateNotifications({
    bool? morningEnabled,
    String? morningTime,
    bool? nightEnabled,
    String? nightTime,
    bool? weeklyEnabled,
    bool? monthlyEnabled,
  }) async {
    setState(() => _isUpdatingNotifications = true);

    try {
      final authDataSource = sl<AuthDataSource>();
      final payload = <String, dynamic>{
        'morningReminderEnabled': morningEnabled ?? _morningReminderEnabled,
        'morningReminderTime': morningTime ?? _morningReminderTime,
        'nightStatusEnabled': nightEnabled ?? _nightStatusEnabled,
        'nightStatusTime': nightTime ?? _nightStatusTime,
        'weeklySummaryEnabled': weeklyEnabled ?? _weeklySummaryEnabled,
        'monthlySummaryEnabled': monthlyEnabled ?? _monthlySummaryEnabled,
      };

      if (_expectedUpdatedAt != null) {
        payload['expectedUpdatedAt'] = _expectedUpdatedAt;
      }

      final res = await authDataSource.updateNotificationSettings(payload);

      if (mounted) {
        setState(() {
          _morningReminderEnabled = res['morningReminderEnabled'] as bool? ?? (morningEnabled ?? _morningReminderEnabled);
          _morningReminderTime = res['morningReminderTime'] as String? ?? (morningTime ?? _morningReminderTime);
          _nightStatusEnabled = res['nightStatusEnabled'] as bool? ?? (nightEnabled ?? _nightStatusEnabled);
          _nightStatusTime = res['nightStatusTime'] as String? ?? (nightTime ?? _nightStatusTime);
          _weeklySummaryEnabled = res['weeklySummaryEnabled'] as bool? ?? (weeklyEnabled ?? _weeklySummaryEnabled);
          _monthlySummaryEnabled = res['monthlySummaryEnabled'] as bool? ?? (monthlyEnabled ?? _monthlySummaryEnabled);
          _expectedUpdatedAt = res['updatedAt'] as String?;
          _isUpdatingNotifications = false;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('Notification preferences saved!'),
              ],
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUpdatingNotifications = false);
        final errStr = e.toString().replaceAll('Exception: ', '');
        final isConflict = errStr.contains('SETTINGS_CONFLICT') || errStr.contains('409') || errStr.contains('another session');

        if (isConflict) {
          _fetchUserProfile();
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  isConflict ? Icons.sync_problem_rounded : Icons.error_outline_rounded,
                  color: Colors.white,
                  size: 18,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isConflict
                        ? 'Settings updated in another session. Reloaded latest.'
                        : 'Could not save: $errStr',
                  ),
                ),
              ],
            ),
            backgroundColor: isConflict ? const Color(0xFFF59E0B) : const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  Future<void> _pickReminderTime({
    required BuildContext context,
    required String initialTime,
    required bool isMorning,
  }) async {
    final parts = initialTime.split(':');
    final initialHour = int.tryParse(parts.first) ?? (isMorning ? 8 : 21);
    final initialMinute = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;

    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: initialHour, minute: initialMinute),
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final hourStr = picked.hour.toString().padLeft(2, '0');
      final formattedTime = '$hourStr:00';

      if (isMorning) {
        _updateNotifications(morningTime: formattedTime);
      } else {
        _updateNotifications(nightTime: formattedTime);
      }
    }
  }

  String _formatTimeDisplay(String timeStr) {
    try {
      final parts = timeStr.split(':');
      final hour = int.tryParse(parts.first) ?? 8;
      final minute = parts.length > 1 ? parts[1] : '00';
      final period = hour >= 12 ? 'PM' : 'AM';
      final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
      return '$displayHour:$minute $period';
    } catch (_) {
      return timeStr;
    }
  }

  Future<void> _openTelegramBot(BuildContext context) async {
    final Uri telegramAppUri = Uri.parse('tg://resolve?domain=${ProfilePage.botUsername}');
    final Uri telegramWebUri = Uri.parse('https://t.me/${ProfilePage.botUsername}');

    try {
      bool launched = false;
      try {
        launched = await launchUrl(telegramAppUri, mode: LaunchMode.externalApplication);
      } catch (_) {}

      if (!launched) {
        await launchUrl(telegramWebUri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open Telegram'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }

  Future<void> _logout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disconnect Account'),
        content: const Text(
          'Are you sure you want to log out from this device? You can reconnect anytime using a Telegram pairing code.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Log Out', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final authDataSource = sl<AuthDataSource>();
      await authDataSource.clearSession();

      if (context.mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const TelegramConnectPage(isFirstPage: true)),
          (route) => false,
        );
      }
    }
  }

  String _getInitials(String name) {
    final parts = name.trim().split(' ').where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'M';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length > 1 ? 2 : 1).toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  String _formatVerifiedDate(String? iso) {
    if (iso == null) return 'Connected';
    try {
      final date = DateTime.parse(iso).toLocal();
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return 'Verified ${months[date.month - 1]} ${date.day}, ${date.year}';
    } catch (_) {
      return 'Verified';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor = isDark ? const Color(0xFF090714) : const Color(0xFFF6F7FB);
    final cardColor = isDark ? const Color(0xFF130E29) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF9E9AC0) : const Color(0xFF64748B);
    const telegramBlue = Color(0xFF2AABEE);
    const primaryEmerald = Color(0xFF10B981);

    return Scaffold(
      backgroundColor: bgColor,
      body: Column(
        children: [
          // 1. Pinned Non-Scrollable Top Profile Hero Section
          _buildFixedTopProfileHero(
            isDark: isDark,
            cardColor: cardColor,
            textColor: textColor,
            subtextColor: subtextColor,
            primaryEmerald: primaryEmerald,
            telegramBlue: telegramBlue,
          ),

          // 2. Scrollable Settings Content
          Expanded(
            child: ListView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 120),
              children: [
                // Telegram Notifications & Quiet Hours Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Telegram Reminders & Summaries',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                        letterSpacing: -0.2,
                      ),
                    ),
                    if (_isUpdatingNotifications)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: primaryEmerald),
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                Container(
                  decoration: BoxDecoration(
                    color: cardColor,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                    ),
                  ),
                  child: Column(
                    children: [
                      // Morning Reminder
                      SwitchListTile(
                        secondary: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.wb_sunny_rounded, color: Color(0xFFF59E0B), size: 20),
                        ),
                        title: Text(
                          'Morning Reminder',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor),
                        ),
                        subtitle: GestureDetector(
                          onTap: () => _pickReminderTime(
                            context: context,
                            initialTime: _morningReminderTime,
                            isMorning: true,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Row(
                              children: [
                                Text(
                                  'Sent at ${_formatTimeDisplay(_morningReminderTime)}',
                                  style: TextStyle(fontSize: 12, color: subtextColor),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.edit_rounded, size: 12, color: primaryEmerald),
                              ],
                            ),
                          ),
                        ),
                        value: _morningReminderEnabled,
                        activeThumbColor: primaryEmerald,
                        onChanged: (val) => _updateNotifications(morningEnabled: val),
                      ),

                      Divider(height: 1, indent: 56, endIndent: 16, color: isDark ? const Color(0xFF1E173E) : const Color(0xFFF1F5F9)),

                      // Evening / Night Status
                      SwitchListTile(
                        secondary: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8B5CF6).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.nightlight_round, color: Color(0xFF8B5CF6), size: 20),
                        ),
                        title: Text(
                          'Evening Financial Status',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor),
                        ),
                        subtitle: GestureDetector(
                          onTap: () => _pickReminderTime(
                            context: context,
                            initialTime: _nightStatusTime,
                            isMorning: false,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Row(
                              children: [
                                Text(
                                  'Sent at ${_formatTimeDisplay(_nightStatusTime)}',
                                  style: TextStyle(fontSize: 12, color: subtextColor),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.edit_rounded, size: 12, color: primaryEmerald),
                              ],
                            ),
                          ),
                        ),
                        value: _nightStatusEnabled,
                        activeThumbColor: primaryEmerald,
                        onChanged: (val) => _updateNotifications(nightEnabled: val),
                      ),

                      Divider(height: 1, indent: 56, endIndent: 16, color: isDark ? const Color(0xFF1E173E) : const Color(0xFFF1F5F9)),

                      // Weekly Summary
                      SwitchListTile(
                        secondary: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.calendar_view_week_rounded, color: Color(0xFF10B981), size: 20),
                        ),
                        title: Text(
                          'Weekly Spending Digest',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor),
                        ),
                        subtitle: Text(
                          'Sent every Sunday evening',
                          style: TextStyle(fontSize: 12, color: subtextColor),
                        ),
                        value: _weeklySummaryEnabled,
                        activeThumbColor: primaryEmerald,
                        onChanged: (val) => _updateNotifications(weeklyEnabled: val),
                      ),

                      Divider(height: 1, indent: 56, endIndent: 16, color: isDark ? const Color(0xFF1E173E) : const Color(0xFFF1F5F9)),

                      // Monthly Summary
                      SwitchListTile(
                        secondary: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.auto_graph_rounded, color: Color(0xFF3B82F6), size: 20),
                        ),
                        title: Text(
                          'Monthly Financial Report',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor),
                        ),
                        subtitle: Text(
                          'Comprehensive monthly analytics',
                          style: TextStyle(fontSize: 12, color: subtextColor),
                        ),
                        value: _monthlySummaryEnabled,
                        activeThumbColor: primaryEmerald,
                        onChanged: (val) => _updateNotifications(monthlyEnabled: val),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Appearance Section
                Text(
                  'appearance'.tr(),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 10),
                BlocBuilder<SettingsCubit, SettingsState>(
                  builder: (context, state) {
                    return Container(
                      decoration: BoxDecoration(
                        color: cardColor,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: SwitchListTile(
                        secondary: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.amber.withValues(alpha: 0.15) : Colors.indigo.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            state.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                            color: state.isDark ? Colors.amber : Colors.indigo,
                            size: 20,
                          ),
                        ),
                        title: Text('darkMode'.tr(), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor)),
                        value: state.isDark,
                        activeThumbColor: primaryEmerald,
                        onChanged: (val) => context.read<SettingsCubit>().setDarkMode(val),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 24),

                // Language Section
                Text(
                  'language'.tr(),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: 10),
                Builder(
                  builder: (context) {
                    final currentLocale = context.locale;
                    final options = [
                      (const Locale('en'), 'english'.tr(), 'English'),
                      (const Locale('am'), 'amharic'.tr(), 'አማርኛ'),
                    ];

                    return Container(
                      decoration: BoxDecoration(
                        color: cardColor,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Column(
                        children: options.map((opt) {
                          final isSelected = currentLocale.languageCode == opt.$1.languageCode;
                          return ListTile(
                            title: Row(
                              children: [
                                Text(opt.$2, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: textColor)),
                                const SizedBox(width: 8),
                                Text(opt.$3, style: TextStyle(fontSize: 12, color: subtextColor)),
                              ],
                            ),
                            leading: Icon(
                              isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                              color: isSelected ? primaryEmerald : subtextColor,
                              size: 20,
                            ),
                            trailing: isSelected
                                ? const Icon(Icons.check_circle_rounded, color: primaryEmerald, size: 20)
                                : null,
                            onTap: () async {
                              await context.setLocale(opt.$1);
                              if (context.mounted) {
                                context.read<SettingsCubit>().setLocale(opt.$1);
                              }
                            },
                          );
                        }).toList(),
                      ),
                    );
                  },
                ),

                const SizedBox(height: 24),

                // Logout / Disconnect Button
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: () => _logout(context),
                    icon: const Icon(Icons.logout_rounded, size: 18, color: Colors.white),
                    label: const Text(
                      'Disconnect Account',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14.5,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 2,
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

  // ── Fixed Top Profile Hero Section ──
  Widget _buildFixedTopProfileHero({
    required bool isDark,
    required Color cardColor,
    required Color textColor,
    required Color subtextColor,
    required Color primaryEmerald,
    required Color telegramBlue,
  }) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Page Header Title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Account & Profile',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: textColor,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Manage your verified identity & preferences',
                      style: TextStyle(fontSize: 13, color: subtextColor),
                    ),
                  ],
                ),
                IconButton(
                  onPressed: _isLoadingProfile ? null : _fetchUserProfile,
                  icon: const Icon(Icons.refresh_rounded, size: 20),
                  color: primaryEmerald,
                  tooltip: 'Refresh Profile',
                ),
              ],
            ),

            const SizedBox(height: 14),

            // Verified User & Telegram Identity Hero Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isDark
                      ? [const Color(0xFF191238), const Color(0xFF120D29)]
                      : [Colors.white, const Color(0xFFF8FAFC)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: isDark ? const Color(0xFF2B1F5E) : const Color(0xFFE2E8F0),
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
              child: _isLoadingProfile
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: CircularProgressIndicator(color: Color(0xFF10B981), strokeWidth: 2.5),
                      ),
                    )
                  : Column(
                      children: [
                        Row(
                          children: [
                            // Glowing Telegram / User Avatar
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Container(
                                  width: 60,
                                  height: 60,
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF10B981), Color(0xFF059669)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: primaryEmerald.withValues(alpha: 0.35),
                                        blurRadius: 14,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: Center(
                                    child: Text(
                                      _getInitials(_displayName),
                                      style: const TextStyle(
                                        fontSize: 22,
                                        fontWeight: FontWeight.w900,
                                        color: Colors.white,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  bottom: -2,
                                  right: -2,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: telegramBlue,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: isDark ? const Color(0xFF191238) : Colors.white,
                                        width: 2,
                                      ),
                                    ),
                                    child: const Icon(Icons.send_rounded, color: Colors.white, size: 12),
                                  ),
                                ),
                              ],
                            ),

                            const SizedBox(width: 16),

                            // User Name & Telegram Handle
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          _displayName,
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w900,
                                            color: textColor,
                                            letterSpacing: -0.2,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 18),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    _username != null && _username!.isNotEmpty
                                        ? '@$_username'
                                        : 'Telegram Verified User',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: telegramBlue,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _telegramId != null
                                        ? 'ID: $_telegramId • ${_formatVerifiedDate(_verifiedAt)}'
                                        : _formatVerifiedDate(_verifiedAt),
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w500,
                                      color: subtextColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 18),

                        // Status Badge Row
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF0C091A) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: isDark ? const Color(0xFF231A47) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF10B981),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Status: ${_accountStatus == 'ACTIVE' ? 'Active & Synced' : _accountStatus}',
                                    style: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: textColor,
                                    ),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text(
                                  'Linked',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF10B981),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 14),

                        // Open Telegram Bot Action Button
                        SizedBox(
                          width: double.infinity,
                          height: 46,
                          child: OutlinedButton.icon(
                            onPressed: () => _openTelegramBot(context),
                            icon: Icon(Icons.open_in_new_rounded, size: 16, color: telegramBlue),
                            label: Text(
                              'Open @${ProfilePage.botUsername} in Telegram',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                                color: telegramBlue,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: telegramBlue.withValues(alpha: 0.5),
                                width: 1.2,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
