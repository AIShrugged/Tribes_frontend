import type { ProfileIdentity } from '@/entities/user';
import { API_URL } from '@/shared/lib/config';
import { getAuthHeaders } from '@/shared/lib/getAuthToken';

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
}

export async function GET() {
  let headers: Record<string, string>;

  try {
    headers = await getAuthHeaders();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/users/me/identities`, {
    headers,
    cache: 'no-store',
  });

  if (!res.ok) {
    return Response.json({ error: 'Failed to fetch identities' }, { status: res.status });
  }

  const json: ApiEnvelope<ProfileIdentity[]> = await res.json();
  return Response.json(json.data ?? []);
}
