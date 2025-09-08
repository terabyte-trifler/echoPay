'use client';

import React, { use } from 'react';
import useSWR from 'swr';

const API = process.env.NEXT_PUBLIC_API as string; // e.g. http://localhost:4000
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 404) {
    // not found yet — let SWR keep polling
    const err = new Error('not_ready');
    // @ts-ignore add code marker
    (err.code = 404);
    throw err;
  }
  if (!res.ok) throw new Error('server_error');
  return res.json();
};

export default function ReceiptView(props: { params: Promise<{ code: string }> }) {
  const { code } = use(props.params); // Next 15+ params are a Promise

  const { data, error, isLoading } = useSWR(
    () => (code ? `${API}/verify/${code}` : null),
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 1500, // keep polling until backend indexes it
      shouldRetryOnError: true,
    }
  );

  if (isLoading) return <p className="p-6">Waiting for receipt…</p>;

  // If it’s a 404 “not_ready”, show spinner text instead of “Not found”
  if (error && (error as any)?.code === 404)
    return <p className="p-6">Indexing on-chain receipt… (auto-refreshing)</p>;

  if (error) return <p className="p-6">Error loading receipt.</p>;
  if (!data?.ok) return <p className="p-6">Receipt not found.</p>;

  const r = data.receipt as {
    code: string;
    amount: string;
    token: string;
    merchant: string;
  };

  return (
    <main className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">Receipt #{r.code}</h1>
      <p>
        Amount: {r.amount}{' '}
        token:{' '}
        {r.token.toLowerCase() === '0x0000000000000000000000000000000000000000'
          ? 'S (native)'
          : 'ERC-20'}
      </p>
      <p>Merchant: {r.merchant.slice(0, 8)}…</p>
      {data.explorer ? (
        <a className="text-blue-600 underline" href={data.explorer} target="_blank">
          View on Explorer
        </a>
      ) : null}
      <img
        src={`${API}/qr/${r.code}`}
        alt="QR"
        className="w-48 h-48 border rounded"
      />
      <button className="btn" onClick={() => window.print()}>
        Download / Print
      </button>
    </main>
  );
}
