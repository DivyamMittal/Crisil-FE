export type ToastTone = "success" | "error";

export type ToastPayload = {
  message: string;
  tone: ToastTone;
};

const TOAST_EVENT = "crisil:toast";

export const showToast = (payload: ToastPayload) => {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
};

export const showSuccessToast = (message: string) => {
  showToast({ message, tone: "success" });
};

export const showErrorToast = (message: string) => {
  showToast({ message, tone: "error" });
};

export const toastEventName = TOAST_EVENT;

