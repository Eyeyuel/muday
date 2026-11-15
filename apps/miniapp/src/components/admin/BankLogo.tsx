import { Banknote } from 'lucide-react';

export function getBankLogoUrl(platform?: string | null): string | null {
  if (!platform) return null;
  const p = platform.toLowerCase().trim();
  if (p.includes('telebirr')) return '/bank_logos/TeleBirr Logo.svg';
  if (p.includes('cbe') || p.includes('commercial bank'))
    return '/bank_logos/Commercial Bank of Ethiopia Logo.svg';
  if (p.includes('dashen') || p.includes('amole')) return '/bank_logos/Dashen Bank Logo.svg';
  if (p.includes('awash')) return '/bank_logos/Awash International Bank ( No text ) Logo.svg';
  if (p.includes('abyssinia') || p.includes('boa')) return '/bank_logos/Bank of Abyssinia Logo.svg';
  if (p.includes('coop') || p.includes('oromia'))
    return '/bank_logos/Cooperative Bank of Oromia Logo.svg';
  if (p.includes('wegagen')) return '/bank_logos/Wegagen Bank Logo.svg';
  if (p.includes('hibret')) return '/bank_logos/Hibret Bank ( No text ) Logo.svg';
  if (p.includes('zemen')) return '/bank_logos/Zemen Bank Logo.svg';
  return null;
}

export function BankLogo({
  platform,
  className = 'size-4',
  imgClassName = 'size-full object-contain',
}: {
  platform?: string | null;
  className?: string;
  imgClassName?: string;
}) {
  const logoUrl = getBankLogoUrl(platform);

  if (logoUrl) {
    return (
      <div
        className={`flex items-center justify-center shrink-0 overflow-hidden rounded-md ${className}`}
      >
        <img
          src={logoUrl}
          alt={platform ?? 'Bank'}
          className={imgClassName}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Fallback for Cash or generic
  return (
    <div
      className={`flex items-center justify-center shrink-0 rounded-md bg-[#10b981]/15 text-[#10b981] ${className}`}
    >
      <Banknote className="size-3.5" />
    </div>
  );
}
