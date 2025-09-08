// Match your Solidity exactly:
// function payETH(address merchant, string code, string metaURI) payable
export const PAY_ABI = [
    "function payETH(address merchant, string code, string metaURI) payable"
  ] as const;
  