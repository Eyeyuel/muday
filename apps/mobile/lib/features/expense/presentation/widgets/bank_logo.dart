import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../../core/constants/bank_senders.dart';

class BankLogo extends StatelessWidget {
  const BankLogo({
    super.key,
    this.source,
    this.size = 36,
    this.borderRadius,
    this.showBorder = true,
    this.elevation = 0,
  });

  final BankSource? source;
  final double size;
  final BorderRadius? borderRadius;
  final bool showBorder;
  final double elevation;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(size * 0.28);

    final bankSource = source;
    if (bankSource == null) {
      final isDark = Theme.of(context).brightness == Brightness.dark;
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1B1535) : const Color(0xFFF1F5F9),
          borderRadius: radius,
          border: showBorder
              ? Border.all(
                  color: isDark ? const Color(0xFF2E2657) : const Color(0xFFE2E8F0),
                  width: 1,
                )
              : null,
        ),
        child: Center(
          child: Icon(
            Icons.receipt_long_rounded,
            size: size * 0.52,
            color: const Color(0xFF8B5CF6),
          ),
        ),
      );
    }

    final svgPath = bankSource.svgAssetPath;

    Widget content;
    if (svgPath != null) {
      content = Padding(
        padding: EdgeInsets.all(size * 0.12),
        child: SvgPicture.asset(
          svgPath,
          width: size,
          height: size,
          fit: BoxFit.contain,
          placeholderBuilder: (_) => _BankBrandBadge(source: bankSource, size: size),
        ),
      );
    } else {
      final onlineUrl = bankSource.primaryLogoUrl;
      if (onlineUrl != null && onlineUrl.isNotEmpty) {
        content = Image.network(
          onlineUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          headers: const {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          },
          errorBuilder: (context, error, stackTrace) {
            return _BankBrandBadge(source: bankSource, size: size);
          },
          loadingBuilder: (context, child, loadingProgress) {
            if (loadingProgress == null) return child;
            return _BankBrandBadge(source: bankSource, size: size);
          },
        );
      } else {
        content = _BankBrandBadge(source: bankSource, size: size);
      }
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: radius,
        boxShadow: elevation > 0
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: elevation * 2,
                  offset: Offset(0, elevation),
                ),
              ]
            : null,
        border: showBorder
            ? Border.all(
                color: Colors.black.withValues(alpha: 0.08),
                width: 1,
              )
            : null,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: content,
      ),
    );
  }
}

class _BankBrandBadge extends StatelessWidget {
  const _BankBrandBadge({
    required this.source,
    required this.size,
  });

  final BankSource source;
  final double size;

  @override
  Widget build(BuildContext context) {
    final fontSize = (size * 0.36).clamp(9.0, 20.0);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            source.brandColor,
            source.brandSecondaryColor,
          ],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        source.shortCode,
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
        maxLines: 1,
        overflow: TextOverflow.clip,
      ),
    );
  }
}
