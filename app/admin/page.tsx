'use client';

import { useEffect, useState } from 'react';

export default function AdminPage() {
  const [listingId, setListingId] = useState('');
  const [status, setStatus] = useState('active');
  const [tier, setTier] = useState('gold');
  const [bidCpm, setBidCpm] = useState('25');
  const [message, setMessage] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [sponsorships, setSponsorships] = useState<Array<any>>([]);

  useEffect(() => {
    const stored = localStorage.getItem('admin_password');
    if (stored) setAdminPassword(stored);
  }, []);

  const loadSponsorships = async (password: string) => {
    const response = await fetch('/api/admin/sponsorships', {
      headers: { 'x-admin-password': password }
    });
    if (!response.ok) return;
    const data = await response.json();
    setSponsorships(data.sponsorships ?? []);
  };

  const submit = async () => {
    setMessage('');
    localStorage.setItem('admin_password', adminPassword);
    const response = await fetch('/api/admin/sponsorships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
      credentials: 'same-origin',
      body: JSON.stringify({
        listingId: Number(listingId),
        status,
        tier,
        bidCpm: Number(bidCpm),
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        targeting: {}
      })
    });

    if (!response.ok) {
      setMessage('Failed to create sponsorship.');
      return;
    }
    setMessage('Sponsorship saved.');
    loadSponsorships(adminPassword).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="mx-auto max-w-xl space-y-6 rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sponsor a Listing</h1>
        <input
          className="w-full rounded border border-gray-200 p-2"
          placeholder="Admin password"
          type="password"
          value={adminPassword}
          onChange={(event) => setAdminPassword(event.target.value)}
        />
        <input
          className="w-full rounded border border-gray-200 p-2"
          placeholder="Listing ID"
          value={listingId}
          onChange={(event) => setListingId(event.target.value)}
        />
        <select className="w-full rounded border border-gray-200 p-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <select className="w-full rounded border border-gray-200 p-2" value={tier} onChange={(event) => setTier(event.target.value)}>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </select>
        <input
          className="w-full rounded border border-gray-200 p-2"
          placeholder="Bid CPM"
          value={bidCpm}
          onChange={(event) => setBidCpm(event.target.value)}
        />
        <button
          className="rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          onClick={submit}
        >
          Save Sponsorship
        </button>
        <button
          className="rounded border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
          onClick={() => loadSponsorships(adminPassword)}
        >
          Refresh Sponsorships
        </button>
        {message && <p className="text-sm text-gray-500">{message}</p>}
        <div className="space-y-2">
          {sponsorships.map((sponsorship) => (
            <div key={sponsorship.id} className="rounded border border-gray-100 p-3 text-xs text-gray-600">
              <p className="font-semibold text-gray-800">{sponsorship.name}</p>
              <p>Status: {sponsorship.status} • Tier: {sponsorship.tier}</p>
              <p>Impressions: {sponsorship.impressions} • Clicks: {sponsorship.clicks}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
