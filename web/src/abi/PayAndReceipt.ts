// Minimal ABI containing only payETH
export default [
    {
      name: 'payETH',
      type: 'function',
      stateMutability: 'payable',
      inputs: [
        { name: 'merchant', type: 'address' },
        { name: 'code', type: 'string' },
        { name: 'metaURI', type: 'string' },
      ],
      outputs: [],
    },
  ] as const;
  