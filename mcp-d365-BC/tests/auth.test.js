import { jest } from '@jest/globals';

// Mock keytar before importing auth
jest.unstable_mockModule('keytar', () => ({
  default: {
    getPassword: jest.fn(),
    setPassword: jest.fn(),
    deletePassword: jest.fn(),
  },
}));

jest.unstable_mockModule('@azure/msal-node', () => ({
  PublicClientApplication: jest.fn().mockImplementation(() => ({
    acquireTokenByDeviceCode: jest.fn(),
  })),
}));

const { getToken, clearToken } = await import('../lib/auth.js');
const keytar = (await import('keytar')).default;

describe('getToken', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns cached token when valid', async () => {
    const future = Date.now() + 3600 * 1000;
    keytar.getPassword.mockResolvedValue(
      JSON.stringify({ accessToken: 'cached', expiresOn: future })
    );
    const token = await getToken();
    expect(token.accessToken).toBe('cached');
    expect(keytar.getPassword).toHaveBeenCalledTimes(1);
  });

  test('re-authenticates when cached token is expired', async () => {
    const past = Date.now() - 1000;
    keytar.getPassword.mockResolvedValue(
      JSON.stringify({ accessToken: 'old', expiresOn: past })
    );
    const { PublicClientApplication } = await import('@azure/msal-node');
    const mockAcquire = jest.fn().mockResolvedValue({
      accessToken: 'new',
      expiresOn: new Date(Date.now() + 3600 * 1000),
    });
    PublicClientApplication.mockImplementation(() => ({
      acquireTokenByDeviceCode: mockAcquire,
    }));
    const token = await getToken();
    expect(token.accessToken).toBe('new');
  });

  test('re-authenticates when no cached token', async () => {
    keytar.getPassword.mockResolvedValue(null);
    const { PublicClientApplication } = await import('@azure/msal-node');
    const mockAcquire = jest.fn().mockResolvedValue({
      accessToken: 'fresh',
      expiresOn: new Date(Date.now() + 3600 * 1000),
    });
    PublicClientApplication.mockImplementation(() => ({
      acquireTokenByDeviceCode: mockAcquire,
    }));
    const token = await getToken();
    expect(token.accessToken).toBe('fresh');
  });
});

describe('clearToken', () => {
  test('deletes token from keychain', async () => {
    keytar.deletePassword.mockResolvedValue(true);
    await clearToken();
    expect(keytar.deletePassword).toHaveBeenCalledWith('bc365', 'token');
  });
});
