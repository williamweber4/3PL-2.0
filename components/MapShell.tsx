'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView, { ListingPoint } from '@/components/MapView';
import Sidebar from '@/components/Sidebar';

export default function MapShell() {
  const [points, setPoints] = useState<ListingPoint[]>([]);
  const [listings, setListings] = useState<ListingPoint[]>([]);
  const [bbox, setBbox] = useState<string>('');
  const [filters, setFilters] = useState({
    state: '',
    city: '',
    types: '',
    services: '',
    minSqft: '',
    maxSqft: '',
    keyword: ''
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (bbox) params.set('bbox', bbox);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [bbox, filters]);

  const fetchListings = useCallback(async () => {
    if (!bbox) return;
    const response = await fetch(`/api/listings?${query}`);
    if (!response.ok) return;
    const data = await response.json();
    setListings(data.listings ?? []);
    setPoints(data.points ?? []);
  }, [bbox, query]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return (
    <div className="flex h-full">
      <Sidebar listings={listings} filters={filters} onChangeFilters={setFilters} />
      <MapView listings={points} onBboxChange={setBbox} />
    </div>
  );
}
