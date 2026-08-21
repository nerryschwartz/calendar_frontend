import { summarizeDraftEdit, type DraftEdit } from "../api/types";

interface DraftQueuePanelProps {
  edits: DraftEdit[];
  onRemove: (index: number) => void;
}

export default function DraftQueuePanel({
  edits,
  onRemove,
}: DraftQueuePanelProps) {
  if (edits.length === 0) return null;

  return (
    <div className="draft-queue-panel detail-panel">
      <h3>Pending edits ({edits.length})</h3>
      <p className="muted">
        These changes are queued locally and will run in order when you save.
      </p>
      <ol className="draft-queue-list">
        {edits.map((edit, index) => (
          <li key={`${edit.type}-${index}`}>
            <span>{summarizeDraftEdit(edit)}</span>
            <button
              type="button"
              className="btn-text"
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
