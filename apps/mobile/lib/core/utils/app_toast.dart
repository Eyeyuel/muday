import 'package:flutter/material.dart';
import 'package:toastification/toastification.dart';

/// Centralized Toast notification service built with [toastification].
class AppToast {
  AppToast._();

  // ─────────────────────────────────────────────────────────────────────────────
  // Standard Toasts
  // ─────────────────────────────────────────────────────────────────────────────

  static ToastificationItem success({
    BuildContext? context,
    required String title,
    String? description,
    Duration autoCloseDuration = const Duration(seconds: 4),
    Alignment alignment = Alignment.topCenter,
  }) {
    return toastification.show(
      context: context,
      type: ToastificationType.success,
      style: ToastificationStyle.flatColored,
      title: Text(title,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      description: (description != null && description.isNotEmpty)
          ? Text(description,
              style:
                  const TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5))
          : null,
      alignment: alignment,
      autoCloseDuration: autoCloseDuration,
      borderRadius: BorderRadius.circular(16),
      showProgressBar: true,
      dragToClose: true,
      applyBlurEffect: true,
    );
  }

  static ToastificationItem error({
    BuildContext? context,
    required String title,
    String? description,
    Duration autoCloseDuration = const Duration(seconds: 5),
    Alignment alignment = Alignment.topCenter,
  }) {
    return toastification.show(
      context: context,
      type: ToastificationType.error,
      style: ToastificationStyle.flatColored,
      title: Text(title,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      description: (description != null && description.isNotEmpty)
          ? Text(description,
              style:
                  const TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5))
          : null,
      alignment: alignment,
      autoCloseDuration: autoCloseDuration,
      borderRadius: BorderRadius.circular(16),
      showProgressBar: true,
      dragToClose: true,
      applyBlurEffect: true,
    );
  }

  static ToastificationItem info({
    BuildContext? context,
    required String title,
    String? description,
    Duration autoCloseDuration = const Duration(seconds: 4),
    Alignment alignment = Alignment.topCenter,
  }) {
    return toastification.show(
      context: context,
      type: ToastificationType.info,
      style: ToastificationStyle.flatColored,
      title: Text(title,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
      description: (description != null && description.isNotEmpty)
          ? Text(description,
              style:
                  const TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5))
          : null,
      alignment: alignment,
      autoCloseDuration: autoCloseDuration,
      borderRadius: BorderRadius.circular(16),
      showProgressBar: true,
      dragToClose: true,
      applyBlurEffect: true,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Expense-specific: single toast with status header + details + Undo button
  // ─────────────────────────────────────────────────────────────────────────────

  /// Shows a rich expense feedback toast.
  ///
  /// [isSuccess] controls the top status strip (green = saved / red = failed).
  /// [details] is the cleaned-up transaction detail text shown below the header.
  /// [onUndo] — when provided the Undo button appears; tapping it dismisses the
  /// toast and calls back so the caller can call the undo API.
  static ToastificationItem expense({
    BuildContext? context,
    required bool isSuccess,
    required String details,
    VoidCallback? onUndo,
    Duration autoCloseDuration = const Duration(seconds: 12),
    Alignment alignment = Alignment.topCenter,
  }) {
    // Dismiss all previous toasts so only one is ever visible at a time.
    toastification.dismissAll(delayForAnimation: false);

    return toastification.showCustom(
      context: context,
      alignment: alignment,
      autoCloseDuration: autoCloseDuration,
      animationBuilder: (context, animation, alignment, child) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0, -0.15),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            )),
            child: child,
          ),
        );
      },
      builder: (context, holder) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final cardBg =
            isDark ? const Color(0xFF130E26) : Colors.white;

        // Colors driven by success / failure
        final statusColor =
            isSuccess ? const Color(0xFF10B981) : const Color(0xFFEF4444);
        final statusBgColor =
            isSuccess ? const Color(0xFF10B981) : const Color(0xFFEF4444);
        final statusLabel =
            isSuccess ? 'Recorded successfully' : 'Failed to Record';
        final statusIcon = isSuccess
            ? Icons.check_circle_rounded
            : Icons.error_outline_rounded;

        final detailColor =
            isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569);

        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: statusColor.withValues(alpha: isDark ? 0.45 : 0.35),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.45 : 0.12),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(19),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Status header strip ──────────────────────────────────────
                Container(
                  color: statusBgColor.withValues(alpha: isDark ? 0.18 : 0.12),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      Icon(statusIcon, color: statusColor, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          statusLabel,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                          ),
                        ),
                      ),
                      // Dismiss X button
                      GestureDetector(
                        onTap: () =>
                            toastification.dismiss(holder),
                        child: Icon(
                          Icons.close_rounded,
                          size: 16,
                          color: statusColor.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Transaction detail body ──────────────────────────────────
                if (details.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
                    child: Text(
                      details,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: detailColor,
                        height: 1.45,
                      ),
                    ),
                  ),

                // ── Undo button row ──────────────────────────────────────────
                if (isSuccess && onUndo != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        TextButton.icon(
                          onPressed: () {
                            toastification.dismiss(holder);
                            onUndo();
                          },
                          icon: const Icon(
                            Icons.undo_rounded,
                            size: 15,
                            color: Color(0xFFEF4444),
                          ),
                          label: const Text(
                            'Undo',
                            style: TextStyle(
                              color: Color(0xFFEF4444),
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 7),
                            backgroundColor: const Color(0xFFEF4444)
                                .withValues(alpha: 0.12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  const SizedBox(height: 12),
              ],
            ),
          ),
        );
      },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Undo confirmation toast
  // ─────────────────────────────────────────────────────────────────────────────

  static ToastificationItem undo({
    BuildContext? context,
    required String message,
    Duration autoCloseDuration = const Duration(seconds: 4),
    Alignment alignment = Alignment.topCenter,
  }) {
    toastification.dismissAll(delayForAnimation: false);
    return toastification.show(
      context: context,
      type: ToastificationType.warning,
      style: ToastificationStyle.flatColored,
      title: const Text(
        'Transaction Undone',
        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
      ),
      description: Text(
        message,
        style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 12.5),
      ),
      alignment: alignment,
      autoCloseDuration: autoCloseDuration,
      borderRadius: BorderRadius.circular(16),
      showProgressBar: true,
      dragToClose: true,
      applyBlurEffect: true,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: clean raw backend message text
  // ─────────────────────────────────────────────────────────────────────────────

  /// Strips status phrases and emoji from the backend response so only the
  /// meaningful transaction detail remains.
  static String cleanBackendMessage(String raw) {
    // Remove common status phrases/emoji returned by the bot
    var out = raw
        .replaceAll(RegExp(r'[\u2705\u274C\u26A0\uFE0F\u2139\uFE0F]'), '') // ✅❌⚠️ℹ️
        .replaceAll('Recorded successfully', '')
        .replaceAll('Use /undo if this is incorrect.', '')
        .replaceAll('Receipt processed and transaction saved!', '')
        .replaceAll('Voice note processed and transaction logged!', '')
        .replaceAll('Receipt saved!', '')
        .replaceAll('Expense recorded successfully!', '');
    // Collapse multiple blank lines
    out = out.replaceAll(RegExp(r'\n{2,}'), '\n').trim();
    return out;
  }
}
