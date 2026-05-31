interface PricingCardProps {
  name: string;
  price: string;
}

export function PricingCard({ name, price }: PricingCardProps) {
  return (
    <section className="card" data-testid="pricing-card">
      <h2>{name} plan</h2>
      <p className="price">{price}</p>
      <UpgradeButton plan={name} />
    </section>
  );
}

interface UpgradeButtonProps {
  plan: string;
}

function UpgradeButton({ plan }: UpgradeButtonProps) {
  return (
    <button className="cta" data-testid="upgrade-button">
      Upgrade to {plan}
    </button>
  );
}
