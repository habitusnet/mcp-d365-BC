const NPM_REGISTRY = 'https://registry.npmjs.org';

const PACKAGES = [
  '@habitusnet/bc365',
  '@habitusnet/d365bc-admin-mcp',
  '@habitusnet/mcp-business-central',
];

export async function getLatestVersion(pkg) {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(pkg)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data['dist-tags']?.latest ?? null;
  } catch {
    return null;
  }
}

export async function checkVersions() {
  return Promise.all(
    PACKAGES.map(async (pkg) => ({
      package: pkg,
      latest: await getLatestVersion(pkg),
    }))
  );
}
