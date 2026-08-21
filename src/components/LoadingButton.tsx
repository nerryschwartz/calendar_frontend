interface LoadingButtonProps {
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  onClick?: () => void;
  children: string;
}

export default function LoadingButton({
  loading = false,
  loadingLabel,
  disabled = false,
  variant = "primary",
  type = "button",
  onClick,
  children,
}: LoadingButtonProps) {
  const className =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
        ? "btn-danger"
        : "btn-secondary";

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? (loadingLabel ?? `${children}…`) : children}
    </button>
  );
}
