import { PublicClientApplication } from '@azure/msal-node';
import keytar from 'keytar';

const SERVICE = 'bc365';
const ACCOUNT = 'token';
const CLIENT_ID = process.env.BC365_CLIENT_ID ?? 'YOUR_CLIENT_ID';
const AUTHORITY = 'https://login.microsoftonline.com/organizations';
const SCOPES = [
  'https://api.businesscentral.dynamics.com/user_impersonation',
  'User.Read',
];

// Lazy PCA creation so tests can control the mock per-call via
// PublicClientApplication.mockImplementation() before invoking getToken().
function createPca() {
  return new PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: AUTHORITY },
  });
}

export async function getToken() {
  const cached = await keytar.getPassword(SERVICE, ACCOUNT);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.expiresOn > Date.now() + 60_000) return parsed;
    } catch {
      // Corrupt cache — fall through to re-authenticate
    }
  }

  const pca = createPca();
  const response = await pca.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (info) => {
      console.log(info.message);
    },
  });

  const token = {
    accessToken: response.accessToken,
    expiresOn: response.expiresOn instanceof Date
      ? response.expiresOn.getTime()
      : response.expiresOn,
  };
  await keytar.setPassword(SERVICE, ACCOUNT, JSON.stringify(token));
  return token;
}

export async function clearToken() {
  await keytar.deletePassword(SERVICE, ACCOUNT);
}
