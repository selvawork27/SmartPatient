import { asText, pickText } from "@/lib/format";

type SideListProps = {
  title: string;
  items: Record<string, unknown>[];
  primaryKeys: string[];
  secondaryKeys: string[];
  amountKeys?: string[];
  emptyText: string;
};

export function SideList({ title, items, primaryKeys, secondaryKeys, amountKeys = [], emptyText }: SideListProps) {
  return (
    <section className="section">
      <div className="section-header">
        <h3>{title}</h3>
        <span className="pill closed">{items.length}</span>
      </div>
      <div className="section-body">
        {items.length === 0 ? (
          <div className="subtle">{emptyText}</div>
        ) : (
          items.slice(0, 7).map((item, index) => (
            <div className="list-row" key={`${title}-${asText(item.id, String(index))}`}>
              <div>
                <strong>{pickText(item, primaryKeys)}</strong>
                <small>{pickText(item, secondaryKeys, "")}</small>
              </div>
              {amountKeys.length ? <small>{pickText(item, amountKeys, "")}</small> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
