import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';

export const sonicTestnet = {
  id: 14601,
  name: 'Sonic Testnet',
  nativeCurrency: { name: 'S', symbol: 'S', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_SONIC_RPC as string] },
    public:  { http: [process.env.NEXT_PUBLIC_SONIC_RPC as string] },
  },
} as const;

export const wagmiConfig = getDefaultConfig({
  appName: 'echoPay',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID as string,
  chains: [sonicTestnet],
  transports: {
    [sonicTestnet.id]: http(sonicTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
