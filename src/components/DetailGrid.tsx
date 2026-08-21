import type { DetailGridItem } from "../api/types";

interface DetailGridProps {
  items: DetailGridItem[];
}

export default function DetailGrid({ items }: DetailGridProps) {
  return (
    <dl className="detail-grid">
      {items.map((item) => (
        <div key={item.label} className="detail-grid-row">
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
