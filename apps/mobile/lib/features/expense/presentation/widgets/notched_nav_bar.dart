import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

class NotchedNavBar extends StatelessWidget {
  const NotchedNavBar({
    super.key,
    required this.index,
    required this.onChanged,
  });

  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final items = [
      (Icons.home_outlined, Icons.home_rounded, 'home'.tr()),
      (Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, 'banks'.tr()),
      (Icons.settings_outlined, Icons.settings_rounded, 'settings'.tr()),
    ];
    final barColor = Theme.of(context).brightness == Brightness.dark
        ? AppColors.darkCard
        : Colors.white;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return SizedBox(
      height: 92 + bottom,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final slot = width / items.length;
          final notchX = slot * index + slot / 2;

          return Stack(
            clipBehavior: Clip.none,
            children: [
              CustomPaint(
                size: Size(width, 92 + bottom),
                painter: _NotchPainter(notchX: notchX, color: barColor),
              ),
              AnimatedPositioned(
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                left: notchX - 30,
                top: 2,
                child: Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: barColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primary, width: 3.5),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.18),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(
                    items[index].$2,
                    color: AppColors.primary,
                    size: 26,
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.only(top: 28, bottom: bottom > 0 ? 8 : 12),
                child: Row(
                  children: [
                    for (var i = 0; i < items.length; i++)
                      Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => onChanged(i),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (i != index)
                                Icon(
                                  items[i].$1,
                                  color: const Color(0xFFB0A8B8),
                                  size: 24,
                                )
                              else
                                const SizedBox(height: 24),
                              const SizedBox(height: 4),
                              Text(
                                items[i].$3,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: i == index
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: i == index
                                      ? Theme.of(context).colorScheme.onSurface
                                      : const Color(0xFFB0A8B8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: bottom > 8 ? bottom - 2 : 8,
                child: Center(
                  child: Container(
                    width: 96,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFF3A3A3C),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _NotchPainter extends CustomPainter {
  const _NotchPainter({required this.notchX, required this.color});

  final double notchX;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const top = 32.0;
    const dip = 36.0;
    final path = Path()
      ..moveTo(0, top + 18)
      ..quadraticBezierTo(0, top, 18, top)
      ..lineTo(notchX - 44, top)
      ..cubicTo(notchX - 26, top, notchX - 26, top + dip, notchX, top + dip)
      ..cubicTo(notchX + 26, top + dip, notchX + 26, top, notchX + 44, top)
      ..lineTo(size.width - 18, top)
      ..quadraticBezierTo(size.width, top, size.width, top + 18)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    canvas.drawShadow(path, Colors.black.withValues(alpha: 0.12), 10, false);
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_NotchPainter oldDelegate) =>
      oldDelegate.notchX != notchX || oldDelegate.color != color;
}
