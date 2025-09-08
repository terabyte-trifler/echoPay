export default function Home() {
  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">echoPay — Sonic Testnet</h1>
      <p>
        Make a payment and receive an NFT receipt instantly.
      </p>
      <a className="btn" href="/pay">Go to Pay</a>
    </main>
  );
}
