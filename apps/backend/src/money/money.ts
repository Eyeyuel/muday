export class MoneyValidationError extends Error {}

export class Money {
  private constructor(readonly cents: bigint) {}

  static parse(value: string): Money {
    if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(value)) {
      throw new MoneyValidationError('Amount must be a plain decimal with at most two places');
    }
    const [whole = '0', fraction = ''] = value.split('.');
    const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (cents <= 0n) throw new MoneyValidationError('Amount must be greater than zero');
    if (cents >= 100_000_000n) {
      throw new MoneyValidationError('Amount must be below 1,000,000 ETB');
    }
    return new Money(cents);
  }

  isHighValue(): boolean {
    return this.cents > 10_000_000n;
  }

  toDecimalString(): string {
    const whole = this.cents / 100n;
    const fraction = String(this.cents % 100n).padStart(2, '0');
    return `${whole}.${fraction}`;
  }
}
