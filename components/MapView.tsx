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
const usBounds: maplibregl.LngLatBoundsLike = [
  [-126.5, 24.4],
  [-66.5, 49.5]
];
const overlaySourceId = 'openmaptiles';

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
      zoom: 3,
      minZoom: 3,
      maxBounds: usBounds,
      renderWorldCopies: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      if (!map.getSource(overlaySourceId)) {
        map.addSource(overlaySourceId, {
          type: 'vector',
          url: 'https://demotiles.maplibre.org/tiles/tiles.json'
        });
      }

      if (!map.getLayer('state-boundaries')) {
        map.addLayer({
          id: 'state-boundaries',
          type: 'line',
          source: overlaySourceId,
          'source-layer': 'boundary',
          minzoom: 4,
          filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
          paint: {
            'line-color': '#94a3b8',
            'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 7, 1.5],
            'line-opacity': 0.7
          }
        });
      }

      if (!map.getLayer('city-labels')) {
        map.addLayer({
          id: 'city-labels',
          type: 'symbol',
          source: overlaySourceId,
          'source-layer': 'place',
          minzoom: 5,
          filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
          layout: {
            'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 16],
            'text-font': ['Open Sans Bold', 'Noto Sans Bold'],
            'text-offset': [0, 0.6],
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2
          }
        });
      }

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
