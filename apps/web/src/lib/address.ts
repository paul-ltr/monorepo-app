/**
 * French government Base Adresse Nationale (BAN) autocomplete.
 * Public, no-auth, CORS-enabled API — https://api-adresse.data.gouv.fr.
 * Used to search a site's postal address before resolving its energy PDL.
 */
export interface AddressHit {
  label: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
}

interface BanFeature {
  properties?: { label?: string; postcode?: string; city?: string };
  geometry?: { coordinates?: [number, number] };
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`;
    const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: BanFeature[] };
    return (json.features ?? []).map((f) => ({
      label: f.properties?.label ?? '',
      postcode: f.properties?.postcode ?? '',
      city: f.properties?.city ?? '',
      lng: f.geometry?.coordinates?.[0] ?? 0,
      lat: f.geometry?.coordinates?.[1] ?? 0,
    }));
  } catch {
    return [];
  }
}
