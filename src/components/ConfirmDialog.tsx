interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tertiaryLabel?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onTertiary?: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tertiaryLabel,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  onTertiary,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={onTertiary ?? onCancel}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          {tertiaryLabel && onTertiary && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onTertiary}
            >
              {tertiaryLabel}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
