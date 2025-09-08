'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { isAddress, parseEther } from 'viem';
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
// If you prefer JSON: import PAY_ABI from '@/abi/PayAndReceipt.json' assert { type: 'json' };
import PAY_ABI from '@/abi/PayAndReceipt'; // your TS-exported ABI module
import { useSearchParams } from 'next/navigation';

const SONIC_TESTNET_ID = 14601;

export default function PayPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const searchParams = useSearchParams();

  const payAddress =
    (process.env.NEXT_PUBLIC_PAY as `0x${string}` | undefined) ?? undefined;

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('0.01');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Prefill from URL (?mid=&amt=)
  useEffect(() => {
    const mid = searchParams.get('mid');
    const amt = searchParams.get('amt');
    if (mid) setMerchant(mid);
    if (amt) setAmount(amt);
  }, [searchParams]);

  const disabled = useMemo(() => {
    if (!address) return true;
    if (!payAddress) return true;
    if (!isAddress(merchant)) return true;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return true;
    return busy || isPending;
  }, [address, payAddress, merchant, amount, busy, isPending]);

  async function onPay() {
    setMsg(null);

    if (!payAddress) {
      setMsg('NEXT_PUBLIC_PAY is not set in web/.env.local');
      return;
    }
    if (!isAddress(merchant)) {
      setMsg('Merchant must be a valid 0x… address.');
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setMsg('Enter a positive amount.');
      return;
    }

    try {
      setBusy(true);

      // Ensure Sonic Testnet (14601)
      if (chainId !== SONIC_TESTNET_ID) {
        await switchChainAsync({ chainId: SONIC_TESTNET_ID });
      }

      // Generate an 8-char receipt code and log it so you can match it in the backend
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      console.log('using receipt code:', code);

      const metaURI = ''; // fill with IPFS/URL later (Day-5)

      // PayAndReceipt.payETH(address merchant, string code, string metaURI) payable
      const txHash = await writeContractAsync({
        abi: PAY_ABI as any,
        address: payAddress,
        functionName: 'payETH',
        args: [merchant as `0x${string}`, code, metaURI],
        value: parseEther(amount),
      });

      console.log('payETH tx hash:', txHash);

      // Redirect to receipt page — backend will index the event and /verify/:code will resolve
      window.location.href = `/receipt/${code}`;
    } catch (err: any) {
      console.error(err);
      const reason =
        err?.shortMessage ||
        err?.message ||
        'Transaction was rejected or failed. Check wallet & network.';
      setMsg(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pay & Get Receipt</h1>
        <ConnectButton />
      </div>

      <label className="block text-sm">Merchant Address</label>
      <input
        className="w-full border rounded p-2"
        placeholder="0x…"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value.trim())}
      />
      {!merchant || isAddress(merchant) ? null : (
        <p className="text-red-600 text-sm mt-1">Invalid address.</p>
      )}

      <label className="block text-sm mt-2">Amount (S)</label>
      <input
        className="w-full border rounded p-2"
        placeholder="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value.trim())}
      />

      <div className="text-xs text-gray-500">
        Network: {chainId ?? '—'}{' '}
        {chainId !== SONIC_TESTNET_ID && '(switches automatically)'}
      </div>

      <button
        className="w-full bg-black text-white rounded p-3 disabled:opacity-50"
        onClick={onPay}
        disabled={disabled}
      >
        {busy || isPending
          ? 'Confirm in wallet…'
          : address
          ? 'Pay'
          : 'Connect wallet to pay'}
      </button>

      {msg && <p className="text-red-600 text-sm whitespace-pre-wrap">{msg}</p>}

      {!process.env.NEXT_PUBLIC_SONIC_RPC && (
        <p className="text-red-600 text-sm">
          NEXT_PUBLIC_SONIC_RPC not set. Add it in <code>web/.env.local</code>.
        </p>
      )}
      {!process.env.NEXT_PUBLIC_WALLETCONNECT_ID && (
        <p className="text-red-600 text-sm">
          NEXT_PUBLIC_WALLETCONNECT_ID not set. Add it in{' '}
          <code>web/.env.local</code>.
        </p>
      )}
      {!payAddress && (
        <p className="text-red-600 text-sm">
          NEXT_PUBLIC_PAY not set. Add it in <code>web/.env.local</code>.
        </p>
      )}
    </main>
  );
}
