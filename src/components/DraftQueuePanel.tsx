import { summarizeDraftEdit, draftPlanRef, type DraftEdit } from "../api/types";
import { generationIsFresh } from "../utils/generationInput";
import { pendingPlans, generatedLinkState } from "../utils/generatedPlans";

interface DraftQueuePanelProps {
  edits: DraftEdit[];
  onRemove: (index: number) => void;
  onQueue?: (edit: DraftEdit) => void;
  disabled?: boolean;
}

export default function DraftQueuePanel({
  edits,
  onRemove,
  onQueue,
  disabled,
}: DraftQueuePanelProps) {
  if (edits.length === 0) return null;
  const pending = pendingPlans(edits);

  return (
    <div className="draft-queue-panel detail-panel">
      <h3>Pending edits ({edits.length})</h3>
      <ol className="draft-queue-list">
        {edits.map((edit, index) => (
          <li
            key={`${edit.type}-${index}`}
            className={
              edit.type === "generateInstances" ? "generation-queue" : ""
            }
          >
            <div className="draft-queue-row">
              <span>{summarizeDraftEdit(edit)}</span>
              <button
                type="button"
                className="btn-text"
                disabled={disabled}
                onClick={() => onRemove(index)}
              >
                Remove
              </button>
            </div>
            {edit.type === "generateInstances" && (
              <>
                <p
                  className={
                    generationIsFresh(edit, edits) ? "muted" : "error-text"
                  }
                >
                  {generationIsFresh(edit, edits)
                    ? "Ready to save"
                    : "Generation outdated: regenerate instances"}
                </p>
                <ul className="generated-instance-list">
                  {edit.preview.instances.map((instance) => {
                    const item = pending.find(
                      (item) => item.draftId === instance.root_ref,
                    );
                    return (
                      <li key={instance.root_ref}>
                        <span>
                          {
                            instance.nodes.find(
                              (node) => node.ref === instance.root_ref,
                            )?.name
                          }{" "}
                          (instance {instance.instance_index + 1})
                          {item
                            ? ` - ${generatedLinkState(item, edits)}`
                            : " - Omitted"}
                        </span>
                        {item && onQueue && (
                          <button
                            type="button"
                            className="btn-text"
                            disabled={disabled}
                            onClick={() =>
                              onQueue({
                                type: "delete",
                                planRef: draftPlanRef(instance.root_ref),
                              })
                            }
                            aria-label={`Remove instance ${instance.instance_index + 1}`}
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
