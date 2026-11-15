class CounterpartyResult {
  const CounterpartyResult({this.name, this.account});

  final String? name;
  final String? account;
}

abstract final class CounterpartyExtractor {
  static final _nameAndAccountPattern = RegExp(
    r'(?:to|from|paid to|received from)\s+([A-Za-z\s\.\-]{2,35})\s*[\(\[\{]?\s*(\+?[0-9\*]{9,20})\s*[\)\]\}]?',
    caseSensitive: false,
  );

  static final _nameOnlyPattern = RegExp(
    r'(?:to|from|paid to|received from)\s+([A-Za-z\s\.\-]{2,35})(?:\s+acc|\s+account|\s+ref|\s+on|\s+via|\.|\,|$)',
    caseSensitive: false,
  );

  static final _accountPattern = RegExp(
    r'(?:acc(?:ount)?\.?|no\.?|#)\s*:?\s*([0-9A-Za-z]{10,20})',
    caseSensitive: false,
  );

  static CounterpartyResult extract(String body) {
    String? name;
    String? account;

    final nameAccMatch = _nameAndAccountPattern.firstMatch(body);
    if (nameAccMatch != null) {
      name = nameAccMatch.group(1)?.trim();
      account = nameAccMatch.group(2)?.trim();
    } else {
      final nameMatch = _nameOnlyPattern.firstMatch(body);
      if (nameMatch != null) {
        name = nameMatch.group(1)?.trim();
      }
      final accMatch = _accountPattern.firstMatch(body);
      if (accMatch != null) {
        account = accMatch.group(1)?.trim();
      }
    }

    if (name != null) {
      name = name.replaceAll(RegExp(r'\s+(acc|account|ref|on|via)$', caseSensitive: false), '').trim();
      if (name.length < 2) name = null;
    }

    return CounterpartyResult(name: name, account: account);
  }
}
