'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView, { ListingPoint } from '@/components/MapView';
import Sidebar from '@/components/Sidebar';

const fallbackListings: ListingPoint[] = [
  {
    id: 1001,
    listing_id: 'mock-1001',
    name: 'Lone Star Logistics Hub',
    company_name: 'Lone Star Logistics',
    city: 'Dallas',
    state: 'TX',
    square_footage: 450000,
    types: ['Distribution', 'Cross-dock'],
    services: ['Pick & pack', 'Kitting'],
    description: 'Mock listing for marker testing.',
    latitude: 32.7767,
    longitude: -96.797,
    slug: 'lone-star-logistics-hub',
    sponsorship_status: 'active'
  },
  {
    id: 1002,
    listing_id: 'mock-1002',
    name: 'Harbor Freight Forwarding',
    company_name: 'Harbor Freight Forwarding',
    city: 'Los Angeles',
    state: 'CA',
    square_footage: 320000,
    types: ['Port', 'Warehouse'],
    services: ['Drayage', 'Container storage'],
    description: 'Mock listing for marker testing.',
    latitude: 34.0522,
    longitude: -118.2437,
    slug: 'harbor-freight-forwarding',
    sponsorship_status: null
  },
  {
    id: 1003,
    listing_id: 'mock-1003',
    name: 'Great Lakes Fulfillment',
    company_name: 'Great Lakes Fulfillment',
    city: 'Chicago',
    state: 'IL',
    square_footage: 210000,
    types: ['Fulfillment'],
    services: ['Returns', 'Same-day shipping'],
    description: 'Mock listing for marker testing.',
    latitude: 41.8781,
    longitude: -87.6298,
    slug: 'great-lakes-fulfillment',
    sponsorship_status: null
  },
  {
    id: 1004,
    listing_id: 'mock-1004',
    name: 'Midwest Cold Chain',
    company_name: 'Midwest Cold Chain',
    city: 'Kansas City',
    state: 'MO',
    square_footage: 185000,
    types: ['Cold storage'],
    services: ['Refrigerated transport'],
    description: 'Mock listing for marker testing.',
    latitude: 39.0997,
    longitude: -94.5786,
    slug: 'midwest-cold-chain',
    sponsorship_status: 'active'
  },
  {
    id: 1005,
    listing_id: 'mock-1005',
    name: 'Peachtree Distribution Center',
    company_name: 'Peachtree Distribution',
    city: 'Atlanta',
    state: 'GA',
    square_footage: 275000,
    types: ['Distribution'],
    services: ['Inventory management'],
    description: 'Mock listing for marker testing.',
    latitude: 33.749,
    longitude: -84.388,
    slug: 'peachtree-distribution-center',
    sponsorship_status: null
  },
  {
    id: 1006,
    listing_id: 'mock-1006',
    name: 'Keystone 3PL Campus',
    company_name: 'Keystone 3PL',
    city: 'Philadelphia',
    state: 'PA',
    square_footage: 305000,
    types: ['3PL'],
    services: ['Pick & pack', 'LTL shipping'],
    description: 'Mock listing for marker testing.',
    latitude: 39.9526,
    longitude: -75.1652,
    slug: 'keystone-3pl-campus',
    sponsorship_status: null
  },
  {
    id: 1007,
    listing_id: 'mock-1007',
    name: 'Gulf Coast Transload',
    company_name: 'Gulf Coast Transload',
    city: 'Houston',
    state: 'TX',
    square_footage: 390000,
    types: ['Transload'],
    services: ['Rail', 'Cross-dock'],
    description: 'Mock listing for marker testing.',
    latitude: 29.7604,
    longitude: -95.3698,
    slug: 'gulf-coast-transload',
    sponsorship_status: null
  },
  {
    id: 1008,
    listing_id: 'mock-1008',
    name: 'Mountain West Logistics',
    company_name: 'Mountain West Logistics',
    city: 'Denver',
    state: 'CO',
    square_footage: 240000,
    types: ['Warehouse'],
    services: ['Value-added services'],
    description: 'Mock listing for marker testing.',
    latitude: 39.7392,
    longitude: -104.9903,
    slug: 'mountain-west-logistics',
    sponsorship_status: null
  },
  {
    id: 1009,
    listing_id: 'mock-1009',
    name: 'Desert Southwest Fulfillment',
    company_name: 'Desert Southwest',
    city: 'Phoenix',
    state: 'AZ',
    square_footage: 260000,
    types: ['Fulfillment'],
    services: ['Pick & pack', 'Returns'],
    description: 'Mock listing for marker testing.',
    latitude: 33.4484,
    longitude: -112.074,
    slug: 'desert-southwest-fulfillment',
    sponsorship_status: null
  },
  {
    id: 1010,
    listing_id: 'mock-1010',
    name: 'Atlantic Cargo Gateway',
    company_name: 'Atlantic Cargo',
    city: 'Newark',
    state: 'NJ',
    square_footage: 310000,
    types: ['Port', 'Warehouse'],
    services: ['Container storage', 'Drayage'],
    description: 'Mock listing for marker testing.',
    latitude: 40.7357,
    longitude: -74.1724,
    slug: 'atlantic-cargo-gateway',
    sponsorship_status: 'active'
  }
];

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
    const nextListings = data.listings ?? [];
    const nextPoints = data.points ?? [];
    if (!nextListings.length && !nextPoints.length) {
      setListings(fallbackListings);
      setPoints(fallbackListings);
      return;
    }
    setListings(nextListings);
    setPoints(nextPoints);
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
