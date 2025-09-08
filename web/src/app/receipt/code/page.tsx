'use client';
import useSWR from 'swr';

const base = process.env.NEXT_PUBLIC_API as string;
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function ReceiptView({ params: { code } }: { params: { code: string } }) {
  const { data, error } = useSWR(`${base}/verify/${code}`, fetcher);

  if (error) return <p className="p-6">Error loading receipt.</p>;
  if (!data) return <p className="p-6">Loading…</p>;
  if (!data.ok) return <p className="p-6">Not found</p>;

  const r = data.receipt;
  const isNative = r.token === '0x0000000000000000000000000000000000000000';

  return (
    <main className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-semibold">Receipt #{r.code}</h1>
      <p>
        Amount: <b>{r.amount}</b> token: <b>{isNative ? 'S (native)' : 'ERC-20'}</b>
      </p>
      <p>Merchant: {r.merchant.slice(0, 8)}…</p>
      {data.explorer && (
        <a className="text-blue-600 underline" href={data.explorer} target="_blank">
          View on Explorer
        </a>
      )}
      <div className="pt-2">
        <img src={`${base}/qr/${r.code}`} alt="QR" className="w-48 h-48" />
      </div>
      <button className="btn" onClick={() => window.print()}>
        Download / Print
      </button>
    </main>
  );
}
