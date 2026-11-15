class UserModel {
  const UserModel({
    required this.id,
    this.language = 'EN',
    this.status = 'ACTIVE',
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String? ?? '',
      language: json['language'] as String? ?? 'EN',
      status: json['status'] as String? ?? 'ACTIVE',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  final String id;
  final String language;
  final String status;
  final DateTime? createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'language': language,
        'status': status,
        if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
      };
}

class AuthSessionModel {
  const AuthSessionModel({
    required this.sessionId,
    required this.accessToken,
    required this.refreshToken,
    required this.expiresInSeconds,
    this.user,
  });

  factory AuthSessionModel.fromJson(Map<String, dynamic> json) {
    return AuthSessionModel(
      sessionId: json['sessionId'] as String? ?? '',
      accessToken: json['accessToken'] as String? ?? '',
      refreshToken: json['refreshToken'] as String? ?? '',
      expiresInSeconds: json['expiresInSeconds'] as int? ?? 900,
      user: json['user'] != null && json['user'] is Map<String, dynamic>
          ? UserModel.fromJson(json['user'] as Map<String, dynamic>)
          : null,
    );
  }

  final String sessionId;
  final String accessToken;
  final String refreshToken;
  final int expiresInSeconds;
  final UserModel? user;

  Map<String, dynamic> toJson() => {
        'sessionId': sessionId,
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'expiresInSeconds': expiresInSeconds,
        if (user != null) 'user': user!.toJson(),
      };
}
