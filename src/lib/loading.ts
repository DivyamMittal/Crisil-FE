const GLOBAL_LOADING_EVENT = "crisil:global-loading";

export const setGlobalLoading = (visible: boolean) => {
  window.dispatchEvent(
    new CustomEvent<boolean>(GLOBAL_LOADING_EVENT, {
      detail: visible,
    }),
  );
};

export const globalLoadingEventName = GLOBAL_LOADING_EVENT;
