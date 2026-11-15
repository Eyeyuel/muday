class SmsException implements Exception {
  const SmsException(this.message);

  final String message;

  @override
  String toString() => message;
}

class CacheException implements Exception {
  const CacheException(this.message);

  final String message;

  @override
  String toString() => message;
}
