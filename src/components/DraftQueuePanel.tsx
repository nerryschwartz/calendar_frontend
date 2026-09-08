import { summarizeDraftEdit, type DraftEdit } from "../api/types";

interface DraftQueuePanelProps {
  edits: DraftEdit[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export default function DraftQueuePanel({
  edits,
  onRemove,
  disabled,
}: DraftQueuePanelProps) {
  if (edits.length === 0) return null;

  return (
    <div className="draft-queue-panel detail-panel">
      <h3>Pending edits ({edits.length})</h3>
      <ol className="draft-queue-list">
        {edits.map((edit, index) => (
          <li key={`${edit.type}-${index}`}>
            <span>{summarizeDraftEdit(edit)}</span>
            <button
              type="button"
              className="btn-text"
              disabled={disabled}
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
