interface CreditCardProps {
  balance: number;
  holder: string;
  validThru: string;
  cardNumber: string;
  variant?: 'primary' | 'secondary' | 'light';
}

export function CreditCardWidget({
  balance,
  holder,
  validThru,
  cardNumber,
  variant = 'primary',
}: CreditCardProps) {
  return (
    <div className={`credit-card credit-card-${variant}`}>
      <div className="credit-card-top">
        <div>
          <span className="credit-card-label">Balance</span>
          <span className="credit-card-balance">${balance.toLocaleString('es-CO')}</span>
        </div>
        <div className="credit-card-chip" />
      </div>
      <div className="credit-card-middle">
        <div>
          <span className="credit-card-sublabel">CARD HOLDER</span>
          <span className="credit-card-text">{holder}</span>
        </div>
        <div>
          <span className="credit-card-sublabel">VALID THRU</span>
          <span className="credit-card-text">{validThru}</span>
        </div>
      </div>
      <div className="credit-card-bottom">
        <span className="credit-card-number">{cardNumber}</span>
        <div className="credit-card-logo">
          <div className="mc-circle mc-red" />
          <div className="mc-circle mc-yellow" />
        </div>
      </div>
    </div>
  );
}
