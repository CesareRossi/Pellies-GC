import { PublicClientApplication } from '@azure/msal-browser';

const CLIENT_ID = 'd6f0085d-fa96-4c0c-8a86-16e01a11081e';

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const graphScopes = {
  login: ['Files.ReadWrite'],
};

export async function getAccessToken() {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) return null;

  try {
    const response = await msalInstance.acquireTokenSilent({
      scopes: graphScopes.login,
      account: accounts[0],
    });
    return response.accessToken;
  } catch (err) {
    // Silent token failed, try popup
    try {
      const response = await msalInstance.acquireTokenPopup({
        scopes: graphScopes.login,
      });
      return response.accessToken;
    } catch (popupErr) {
      console.error('Token acquisition failed:', popupErr);
      return null;
    }
  }
}

export async function loginMicrosoft() {
  try {
    const response = await msalInstance.loginPopup({
      scopes: graphScopes.login,
    });
    return response;
  } catch (err) {
    console.error('Microsoft login failed:', err);
    throw err;
  }
}

export function logoutMicrosoft() {
  msalInstance.logoutPopup();
}

export function getMicrosoftAccount() {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}
