interface StatusBannerProps {
  variant?: "success" | "info" | "warning";
  message: string | null;
  onDismiss?: () => void;
}

export default function StatusBanner({
  variant = "success",
  message,
  onDismiss,
}: StatusBannerProps) {
  if (!message) return null;

  return (
    <div className={`status-banner status-banner-${variant}`} role="status">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="btn-text" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
