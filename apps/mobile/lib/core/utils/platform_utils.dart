import 'package:flutter/foundation.dart';

abstract final class PlatformUtils {
  static bool get isAndroid => defaultTargetPlatform == TargetPlatform.android;
}
