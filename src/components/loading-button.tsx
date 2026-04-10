import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type LoadingButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
  }
>;

export const LoadingButton = ({
  children,
  className,
  disabled,
  loading = false,
  ...props
}: LoadingButtonProps) => {
  return (
    <button
      {...props}
      className={`${className ?? ""}${loading ? " button-loading" : ""}`.trim()}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="button-loading__spinner" aria-hidden="true" />
          <span className="button-loading__label">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};
