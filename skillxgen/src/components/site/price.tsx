import { setCurrency } from "@/app/(site)/actions";
import { CURRENCIES, formatMoney, cn, type Currency } from "@/lib/utils";
import { priceFor, type Priced } from "@/lib/payments/pricing";

export function Price({ programme, currency, className }: { programme: Priced; currency: Currency; className?: string }) {
  const amount = priceFor(programme, currency);
  if (amount == null) return <span className={className}>By consultation</span>;
  return <span className={className} data-testid="price">{formatMoney(amount, currency)}</span>;
}

export function CurrencySwitcher({ current }: { current: Currency }) {
  return (
    <form action={setCurrency} className="inline-flex rounded-md border border-border p-0.5" aria-label="Display currency">
      {CURRENCIES.map((c) => (
        <button key={c.code} name="currency" value={c.code} aria-pressed={c.code === current}
          className={cn("rounded-sm px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer", c.code === current ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
          {c.label}
        </button>
      ))}
    </form>
  );
}
