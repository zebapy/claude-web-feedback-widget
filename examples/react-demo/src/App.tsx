import { PricingCard } from "./components/PricingCard";

export function App() {
  return (
    <main>
      <h1>Claude web feedback — React demo</h1>
      <p className="lede">
        Toggle the widget (bottom-right), click <strong>Comment</strong>, then pick an element or
        select text. Each comment should reach Claude with a <code>file:line</code> source anchor.
      </p>

      <PricingCard name="Pro" price="$19/mo" />

      <section className="card">
        <h2>Selectable text</h2>
        <p>
          Highlight this sentence and comment on it to test the text-quote anchor (exact match plus
          prefix and suffix context).
        </p>
      </section>
    </main>
  );
}
