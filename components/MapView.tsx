'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export type ListingPoint = {
  id: number;
  listing_id: string;
  name: string;
  company_name: string | null;
  city: string | null;
  state: string | null;
  square_footage: number | null;
  types: string[];
  services: string[];
  description: string | null;
  latitude: number;
  longitude: number;
  slug: string;
  sponsorship_status?: string | null;
};

const styleUrl = process.env.NEXT_PUBLIC_TILE_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

export default function MapView({
  listings,
  onBboxChange
}: {
  listings: ListingPoint[];
  onBboxChange: (bbox: string) => void;
}) {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-98.5795, 39.8283],
      zoom: 3
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      const bounds = map.getBounds();
      onBboxChange(`${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
    });

    map.on('moveend', () => {
      const bounds = map.getBounds();
      onBboxChange(`${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`);
    });

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, [onBboxChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = 'listings';
    const geojson = {
      type: 'FeatureCollection' as const,
      features: listings.map((listing) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [listing.longitude, listing.latitude]
        },
        properties: {
          id: listing.id,
          name: listing.name,
          slug: listing.slug,
          sponsored: listing.sponsorship_status === 'active'
        }
      }))
    };

    if (map.getSource(sourceId)) {
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
      source.setData(geojson);
    } else {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 10
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#94a3b8',
          'circle-radius': ['step', ['get', 'point_count'], 16, 50, 24, 200, 32],
          'circle-opacity': 0.8
        }
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12
        },
        paint: {
          'text-color': '#0f172a'
        }
      });

      map.addLayer({
        id: 'unclustered',
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'case',
            ['==', ['get', 'sponsored'], true],
            '#f59e0b',
            '#2563eb'
          ],
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

      map.on('click', 'unclustered', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const slug = feature.properties?.slug;
        if (slug) {
          window.location.href = `/listing/${slug}`;
        }
      });
    }
  }, [listings]);

  return <div ref={containerRef} className="flex-1" />;
}
