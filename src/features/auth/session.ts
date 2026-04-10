const ACCESS_TOKEN_KEY = "crisil-access-token";

export const getAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY);

export const setAccessToken = (token: string) => {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

export const clearAccessToken = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
};

