import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// PROFILE_PATH exported for external reference (computed at import time using real homedir)
export const PROFILE_PATH = join(homedir(), '.bc365', 'profiles.json');

// Lazy path helpers — always call homedir() at runtime so mocks work in tests
function getProfileDir() {
  return join(homedir(), '.bc365');
}

function getProfilePath() {
  return join(homedir(), '.bc365', 'profiles.json');
}

async function readProfiles() {
  try {
    const data = await readFile(getProfilePath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeProfiles(profiles) {
  const dir = getProfileDir();
  await mkdir(dir, { recursive: true });
  await writeFile(getProfilePath(), JSON.stringify(profiles, null, 2), 'utf8');
}

export async function saveProfile(name, config) {
  const profiles = await readProfiles();
  profiles[name] = { ...config, savedAt: new Date().toISOString() };
  await writeProfiles(profiles);
}

export async function listProfiles() {
  const profiles = await readProfiles();
  return Object.entries(profiles).map(([name, cfg]) => ({ name, ...cfg }));
}

export async function loadProfile(name) {
  const profiles = await readProfiles();
  return profiles[name] ?? null;
}
