'use client';

import { useState, useMemo } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract } from 'wagmi';
import PAY_ABI from '@/abi/PayAndReceipt.json';
import { parseEther, isAddress } from 'viem';

export default function PayPage() {
  const { address, chain } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [merchant, setMerchant] = useState<string>('');
  const [amount, setAmount] = useState<string>('0.01');

  const payAddress = process.env.NEXT_PUBLIC_PAY as `0x${string}`;

  const canPay = useMemo(() => {
    try {
      return !!address && isAddress(merchant) && Number(amount) > 0;
    } catch {
      return false;
    }
  }, [address, merchant, amount]);

  async function onPay() {
    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    const metaURI = ''; // backend will generate real JSON later

    const txHash = await writeContractAsync({
      abi: PAY_ABI as any,
      address: payAddress,
      functionName: 'payETH',
      args: [merchant, code, metaURI],
      value: parseEther(amount),
    });

    // You’ll be redirected to the receipt by code
    window.location.href = `/receipt/${code}`;
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pay & Get Receipt (Sonic Testnet)</h1>
        <ConnectButton />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Merchant address</label>
        <input
          className="input"
          placeholder="0x..."
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Amount (S)</label>
        <input
          className="input"
          placeholder="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button className="btn" disabled={!canPay || isPending} onClick={onPay}>
        {isPending ? 'Confirming...' : 'Pay & Mint Receipt'}
      </button>

      {chain?.id !== 14601 && (
        <p className="text-sm text-amber-600">
          You appear to be on {chain?.name ?? 'an unknown chain'} — switch to <b>Sonic Testnet (14601)</b>.
        </p>
      )}
    </main>
  );
}
