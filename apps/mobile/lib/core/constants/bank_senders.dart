import 'package:flutter/material.dart';

enum BankSource {
  cbe(
    'CBE',
    shortCode: 'CBE',
    brandColor: Color(0xFF6C1D7E),
    brandSecondaryColor: Color(0xFF4A1058),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/cbe.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/cbe.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Commercial_Bank_of_Ethiopia_logo.svg/320px-Commercial_Bank_of_Ethiopia_logo.svg.png',
    ],
  ),
  telebirr(
    'Telebirr',
    shortCode: 'TB',
    brandColor: Color(0xFF00A651),
    brandSecondaryColor: Color(0xFF00833E),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/telebirr.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/telebirr.png',
    ],
  ),
  mpesa(
    'M-Pesa',
    shortCode: 'MP',
    brandColor: Color(0xFFE60000),
    brandSecondaryColor: Color(0xFF00A651),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/mpesa.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/mpesa.png',
    ],
  ),
  abyssina(
    'Abyssinia',
    shortCode: 'BOA',
    brandColor: Color(0xFFF59E0B),
    brandSecondaryColor: Color(0xFFD97706),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/bank-of-abyssinia.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/abyssinia.png',
    ],
  ),
  awash(
    'Awash',
    shortCode: 'AIB',
    brandColor: Color(0xFF1E3A8A),
    brandSecondaryColor: Color(0xFFF97316),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/awash-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/awash.png',
    ],
  ),
  dashen(
    'Dashen',
    shortCode: 'DB',
    brandColor: Color(0xFF0D47A1),
    brandSecondaryColor: Color(0xFFEAB308),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/dashen-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/dashen.png',
    ],
  ),
  wegagen(
    'Wegagen',
    shortCode: 'WB',
    brandColor: Color(0xFFD97706),
    brandSecondaryColor: Color(0xFFB91C1C),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/wegagen-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/wegagen.png',
    ],
  ),
  nib(
    'Nib',
    shortCode: 'NIB',
    brandColor: Color(0xFFEAB308),
    brandSecondaryColor: Color(0xFF0F172A),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/nib-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/nib.png',
    ],
  ),
  coop(
    'Coop Bank',
    shortCode: 'CBO',
    brandColor: Color(0xFF15803D),
    brandSecondaryColor: Color(0xFFD97706),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/cooperative-bank-of-oromia.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/cbo.png',
    ],
  ),
  zemen(
    'Zemen',
    shortCode: 'ZB',
    brandColor: Color(0xFF0284C7),
    brandSecondaryColor: Color(0xFF0F172A),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/zemen-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/zemen.png',
    ],
  ),
  hibret(
    'Hibret',
    shortCode: 'HB',
    brandColor: Color(0xFFF97316),
    brandSecondaryColor: Color(0xFF1E293B),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/hibret-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/hibret.png',
    ],
  ),
  bunna(
    'Bunna',
    shortCode: 'BIB',
    brandColor: Color(0xFF78350F),
    brandSecondaryColor: Color(0xFFF59E0B),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/bunna-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/bunna.png',
    ],
  ),
  enat(
    'Enat',
    shortCode: 'EB',
    brandColor: Color(0xFFDB2777),
    brandSecondaryColor: Color(0xFF4F46E5),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/enat-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/enat.png',
    ],
  ),
  lion(
    'Lion',
    shortCode: 'LIB',
    brandColor: Color(0xFFEA580C),
    brandSecondaryColor: Color(0xFF854D0E),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/lion-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/anbessa.png',
    ],
  ),
  oromia(
    'Oromia',
    shortCode: 'OB',
    brandColor: Color(0xFFDC2626),
    brandSecondaryColor: Color(0xFF16A34A),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/oromia-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/oromia.png',
    ],
  ),
  abay(
    'Abay',
    shortCode: 'AB',
    brandColor: Color(0xFF0284C7),
    brandSecondaryColor: Color(0xFFFACC15),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/abay-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/abay.png',
    ],
  ),
  berhan(
    'Berhan',
    shortCode: 'BB',
    brandColor: Color(0xFFEAB308),
    brandSecondaryColor: Color(0xFF1E293B),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/berhan-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/berhan.png',
    ],
  ),
  addis(
    'Addis',
    shortCode: 'AdIB',
    brandColor: Color(0xFF2563EB),
    brandSecondaryColor: Color(0xFFF59E0B),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/addis-international-bank.png',
    ],
  ),
  amhara(
    'Amhara',
    shortCode: 'AmB',
    brandColor: Color(0xFFEA580C),
    brandSecondaryColor: Color(0xFF1E3A8A),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/amhara-bank.png',
      'https://cdn.jsdelivr.net/gh/hawitariku/EthioUSSD-App@master/assets/amhara.png',
    ],
  ),
  hellocash(
    'HelloCash',
    shortCode: 'HC',
    brandColor: Color(0xFF059669),
    brandSecondaryColor: Color(0xFFF59E0B),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/hellocash.png',
    ],
  ),
  amole(
    'Amole',
    shortCode: 'AML',
    brandColor: Color(0xFF1D4ED8),
    brandSecondaryColor: Color(0xFFF97316),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/amole.png',
    ],
  ),
  kacha(
    'Kacha',
    shortCode: 'KC',
    brandColor: Color(0xFF0D9488),
    brandSecondaryColor: Color(0xFF6366F1),
    logoUrls: [
      'https://raw.githubusercontent.com/Chapa-Et/ethiopianlogos/main/logos/kacha.png',
    ],
  );

  const BankSource(
    this.label, {
    required this.shortCode,
    required this.brandColor,
    required this.brandSecondaryColor,
    required this.logoUrls,
  });

  final String label;
  final String shortCode;
  final Color brandColor;
  final Color brandSecondaryColor;
  final List<String> logoUrls;

  String get assetPath => 'assets/images/banks/$name.png';

  String? get svgAssetPath {
    switch (this) {
      case BankSource.telebirr:
        return 'assets/images/banks/TeleBirr Logo.svg';
      case BankSource.cbe:
        return 'assets/images/banks/Commercial Bank of Ethiopia Logo.svg';
      case BankSource.abyssina:
        return 'assets/images/banks/Bank of Abyssinia Logo.svg';
      case BankSource.awash:
        return 'assets/images/banks/Awash International Bank ( No text ) Logo.svg';
      case BankSource.dashen:
        return 'assets/images/banks/Dashen Bank Logo.svg';
      case BankSource.coop:
        return 'assets/images/banks/Cooperative Bank of Oromia Logo.svg';
      case BankSource.hibret:
        return 'assets/images/banks/Hibret Bank ( No text ) Logo.svg';
      case BankSource.zemen:
        return 'assets/images/banks/Zemen Bank Logo.svg';
      default:
        return null;
    }
  }

  String? get primaryLogoUrl => logoUrls.isNotEmpty ? logoUrls.first : null;
}

abstract final class BankSenders {
  static const senderKeys = <BankSource, List<String>>{
    BankSource.cbe: ['cbebirr', 'cbe birr', 'cbe'],
    BankSource.telebirr: ['telebirr', 'tele birr', '127'],
    BankSource.mpesa: ['mpesa', 'm-pesa', 'm pesa', 'safaricom'],
    BankSource.abyssina: ['abyssinia', 'abyssina', 'bankofabyssinia', 'boa'],
    BankSource.awash: ['awashbank', 'awash'],
    BankSource.dashen: ['dashenbank', 'dashen'],
    BankSource.wegagen: ['wegagen'],
    BankSource.nib: ['nibbank', 'nib'],
    BankSource.coop: ['coopbank', 'cbo', 'cooperativebank'],
    BankSource.zemen: ['zemenbank', 'zemen'],
    BankSource.hibret: ['hibret', 'unitedbank'],
    BankSource.bunna: ['bunnabank', 'bunna'],
    BankSource.enat: ['enatbank', 'enat'],
    BankSource.lion: ['lionbank', 'lion'],
    BankSource.oromia: ['oromiabank', 'oromia'],
    BankSource.abay: ['abaybank', 'abay'],
    BankSource.berhan: ['berhanbank', 'berhan'],
    BankSource.addis: ['addisbank', 'addisinternational'],
    BankSource.amhara: ['amharabank', 'amhara'],
    BankSource.hellocash: ['hellocash', 'hello cash'],
    BankSource.amole: ['amole'],
    BankSource.kacha: ['kacha'],
  };

  static const bodyKeys = <BankSource, List<String>>{
    BankSource.cbe: ['cbe birr', 'cbebirr', 'commercial bank of ethiopia'],
    BankSource.telebirr: ['telebirr', 'tele birr'],
    BankSource.mpesa: ['m-pesa', 'mpesa', 'm pesa'],
    BankSource.abyssina: ['abyssinia', 'bank of abyssinia'],
    BankSource.awash: ['awash bank'],
    BankSource.dashen: ['dashen bank'],
    BankSource.wegagen: ['wegagen bank'],
    BankSource.nib: ['nib bank'],
    BankSource.coop: ['coop bank', 'cooperative bank'],
    BankSource.zemen: ['zemen bank'],
    BankSource.hibret: ['hibret bank'],
    BankSource.bunna: ['bunna bank'],
    BankSource.enat: ['enat bank'],
    BankSource.lion: ['lion bank'],
    BankSource.oromia: ['oromia bank'],
    BankSource.abay: ['abay bank'],
    BankSource.berhan: ['berhan bank'],
    BankSource.addis: ['addis international'],
    BankSource.amhara: ['amhara bank'],
    BankSource.hellocash: ['hellocash', 'hello cash'],
    BankSource.amole: ['amole'],
    BankSource.kacha: ['kacha'],
  };

  static String normalize(String value) {
    return value.toLowerCase().replaceAll(RegExp(r'[\s\-_]+'), '');
  }

  static BankSource? fromSender(String address) =>
      _match(address, senderKeys);

  static BankSource? fromBody(String body) => _match(body, bodyKeys);

  static BankSource? _match(
    String raw,
    Map<BankSource, List<String>> keys,
  ) {
    final text = normalize(raw);
    BankSource? best;
    var bestLength = 0;

    for (final entry in keys.entries) {
      for (final key in entry.value) {
        final token = normalize(key);
        if (token.isEmpty || !text.contains(token)) continue;
        if (token.length > bestLength) {
          best = entry.key;
          bestLength = token.length;
        }
      }
    }
    return best;
  }
}
