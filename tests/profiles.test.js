import { jest } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';

const TEST_HOME = join(tmpdir(), `bc365-test-home-${Date.now()}`);

// Mock homedir() to use a temp directory
jest.unstable_mockModule('node:os', () => ({
  homedir: () => TEST_HOME,
}));

const { saveProfile, listProfiles, loadProfile } = await import('../lib/profiles.js');

afterAll(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
});

describe('profiles', () => {
  test('saves and retrieves a profile', async () => {
    await saveProfile('client-a', {
      tenantId: 'tenant-aaa',
      envName: 'Production',
      companyId: 'co-1',
    });
    const profiles = await listProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    const found = profiles.find((p) => p.name === 'client-a');
    expect(found).toBeDefined();
    expect(found.tenantId).toBe('tenant-aaa');
  });

  test('loads a specific profile', async () => {
    const profile = await loadProfile('client-a');
    expect(profile).not.toBeNull();
    expect(profile.tenantId).toBe('tenant-aaa');
    expect(profile.envName).toBe('Production');
  });

  test('returns null for unknown profile', async () => {
    const profile = await loadProfile('nonexistent-profile-xyz');
    expect(profile).toBeNull();
  });

  test('saves multiple profiles independently', async () => {
    await saveProfile('client-b', { tenantId: 'tenant-bbb', envName: 'Production', companyId: 'co-2' });
    const a = await loadProfile('client-a');
    const b = await loadProfile('client-b');
    expect(a.tenantId).toBe('tenant-aaa');
    expect(b.tenantId).toBe('tenant-bbb');
  });

  test('overwrites existing profile on save', async () => {
    await saveProfile('client-a', { tenantId: 'tenant-updated', envName: 'Sandbox', companyId: 'co-3' });
    const profile = await loadProfile('client-a');
    expect(profile.tenantId).toBe('tenant-updated');
  });
});
