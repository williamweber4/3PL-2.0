'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListingPoint } from '@/components/MapView';

const formatNumber = (value: number | null) => {
  if (!value) return 'N/A';
  return value.toLocaleString();
};

export default function Sidebar({
  listings,
  filters,
  onChangeFilters
}: {
  listings: ListingPoint[];
  filters: {
    state: string;
    city: string;
    types: string;
    services: string;
    minSqft: string;
    maxSqft: string;
    keyword: string;
  };
  onChangeFilters: (filters: typeof filters) => void;
}) {
  const [sponsorships, setSponsorships] = useState<ListingPoint[]>([]);
  const [seenIds, setSeenIds] = useState<number[]>([]);

  const sponsorshipQuery = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/sponsorships?${sponsorshipQuery}`);
      if (!response.ok) return;
      const data = await response.json();
      setSponsorships(data.sponsorships ?? []);
    };
    load();
  }, [sponsorshipQuery]);

  const seenKey = 'sponsorship_seen_ids';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = JSON.parse(sessionStorage.getItem(seenKey) ?? '[]') as number[];
    setSeenIds(stored);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(seenKey, JSON.stringify(seenIds));
  }, [seenIds]);

  const nextSponsor = sponsorships.find((sponsor) => !new Set(seenIds).has(sponsor.id));

  useEffect(() => {
    if (!nextSponsor) return;
    if (listings.length < 10) return;
    setSeenIds((prev) => (prev.includes(nextSponsor.id) ? prev : [...prev, nextSponsor.id]));
    fetch('/api/sponsorships/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorshipId: nextSponsor.id, event: 'impression' })
    }).catch(() => undefined);
  }, [listings.length, nextSponsor]);

  return (
    <aside className="w-full max-w-md border-r border-gray-200 bg-white p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">3PL Marketplace</h1>
        <p className="text-sm text-gray-500">Search warehouses and 3PL providers.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <input
          className="col-span-2 rounded border border-gray-200 p-2"
          placeholder="Keyword"
          value={filters.keyword}
          onChange={(event) => onChangeFilters({ ...filters, keyword: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="State"
          value={filters.state}
          onChange={(event) => onChangeFilters({ ...filters, state: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="City"
          value={filters.city}
          onChange={(event) => onChangeFilters({ ...filters, city: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="Types (comma)"
          value={filters.types}
          onChange={(event) => onChangeFilters({ ...filters, types: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="Services (comma)"
          value={filters.services}
          onChange={(event) => onChangeFilters({ ...filters, services: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="Min sqft"
          value={filters.minSqft}
          onChange={(event) => onChangeFilters({ ...filters, minSqft: event.target.value })}
        />
        <input
          className="rounded border border-gray-200 p-2"
          placeholder="Max sqft"
          value={filters.maxSqft}
          onChange={(event) => onChangeFilters({ ...filters, maxSqft: event.target.value })}
        />
      </div>
      <div className="mt-6 space-y-4">
        {listings.map((listing, index) => {
          const shouldShowAd = (index + 1) % 10 === 0 && nextSponsor;
          return (
            <div key={`${listing.id}-${index}`} className="space-y-4">
              <div className="rounded border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900">{listing.name}</h2>
                  {listing.sponsorship_status === 'active' && (
                    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      Sponsored
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{listing.city}, {listing.state}</p>
                <p className="text-xs text-gray-500">{formatNumber(listing.square_footage)} sqft</p>
                <a
                  href={`/listing/${listing.slug}`}
                  className="mt-2 inline-block text-xs font-medium text-blue-600"
                >
                  View details
                </a>
              </div>
              {shouldShowAd && nextSponsor && (
                <div className="rounded border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-amber-700">Sponsored</p>
                    <span className="text-xs text-amber-600">Ad slot</span>
                  </div>
                  <h3 className="mt-2 font-medium text-gray-900">{nextSponsor.name}</h3>
                  <p className="text-xs text-gray-500">{nextSponsor.city}, {nextSponsor.state}</p>
                  <a
                    className="mt-2 inline-block text-xs font-semibold text-amber-700"
                    href={`/listing/${nextSponsor.slug}`}
                    onClick={() => {
                      fetch('/api/sponsorships/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sponsorshipId: nextSponsor.id, event: 'click' })
                      }).catch(() => undefined);
                    }}
                  >
                    View listing
                  </a>
                </div>
              )}
            </div>
          );
        })}
        {!listings.length && (
          <p className="text-sm text-gray-500">No listings in view. Try zooming out.</p>
        )}
      </div>
    </aside>
  );
}
