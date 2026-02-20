const BC_ADMIN_BASE = 'https://api.businesscentral.dynamics.com/admin/v2.21';
const BC_API_BASE = 'https://api.businesscentral.dynamics.com/v2.0';
const REQUIRED_PERMISSIONS = ['D365 BUS FULL ACCESS'];

async function bcFetch(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });
  if (!res.ok) throw new Error(`BC API error ${res.status}: ${url}`);
  return res.json();
}

export async function getEnvironments(token, opts = {}) {
  const { tenantId, type } = opts;
  const url = tenantId
    ? `${BC_ADMIN_BASE}/applications/BusinessCentral/environments?aadTenantId=${tenantId}`
    : `${BC_ADMIN_BASE}/applications/BusinessCentral/environments`;
  const data = await bcFetch(url, token);
  const envs = data.value ?? [];
  return type ? envs.filter((e) => e.type === type) : envs;
}

export async function getCompanies(env, token) {
  const url = `${BC_API_BASE}/${encodeURIComponent(env.aadTenantId)}/${encodeURIComponent(env.name)}/api/v2.0/companies`;
  const data = await bcFetch(url, token);
  return data.value ?? [];
}

export async function getPermissions(env, token, opts = {}) {
  const { companyId } = opts;
  const url = `${BC_API_BASE}/${encodeURIComponent(env.aadTenantId)}/${encodeURIComponent(env.name)}/api/v2.0/companies(${encodeURIComponent(companyId)})/userPermissions`;
  const data = await bcFetch(url, token);
  const grantedRoles = (data.value ?? []).map((p) => p.roleId);
  return {
    present: REQUIRED_PERMISSIONS.filter((r) => grantedRoles.includes(r)),
    missing: REQUIRED_PERMISSIONS.filter((r) => !grantedRoles.includes(r)),
  };
}
