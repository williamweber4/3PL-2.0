import Image from 'next/image';
import { pool } from '@/lib/db';

export default async function ListingPage({ params }: { params: { slugId: string } }) {
  const { rows } = await pool.query(
    `SELECT listings.*, sponsorships.status AS sponsorship_status
     FROM listings
     LEFT JOIN sponsorships ON sponsorships.listing_id = listings.id
       AND sponsorships.status = 'active'
       AND now() BETWEEN sponsorships.start_at AND sponsorships.end_at
     WHERE listings.slug = $1`,
    [params.slugId]
  );

  const listing = rows[0];
  if (!listing) {
    return <div className="p-10">Listing not found.</div>;
  }

  const images: string[] = listing.images ?? [];

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{listing.name}</h1>
          <p className="text-gray-500">{listing.company_name}</p>
          <p className="text-sm text-gray-500">{listing.address}, {listing.city}, {listing.state} {listing.postal_code}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {images.length ? (
            images.slice(0, 5).map((image, index) => (
              <div key={`${image}-${index}`} className="relative h-56 overflow-hidden rounded-lg bg-gray-100">
                <Image src={image} alt={listing.name} fill className="object-cover" />
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              No images available
            </div>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Size</h2>
            <p className="text-gray-900">{listing.square_footage ?? 'N/A'} sqft</p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Types</h2>
            <div className="flex flex-wrap gap-2">
              {listing.types?.map((type: string) => (
                <span key={type} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700">Services</h2>
            <div className="flex flex-wrap gap-2">
              {listing.services?.map((service: string) => (
                <span key={service} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                  {service}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Description</h2>
          <p className="mt-2 text-sm text-gray-600">{listing.description ?? 'No description provided.'}</p>
        </div>
        {listing.sponsorship_status === 'active' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
            Sponsored placement: highlight this listing with premium visibility.
          </div>
        )}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
          <div className="mt-2 space-y-2 text-sm text-gray-600">
            {listing.website_url && (
              <a className="block text-blue-600" href={listing.website_url}>
                {listing.website_url}
              </a>
            )}
            {listing.email && <p>{listing.email}</p>}
            {listing.phone && <p>{listing.phone}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
