"use client";
import { useAccount } from "wagmi";
import useSWR from "swr";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";

const base = process.env.NEXT_PUBLIC_API!;

export default function Merchant(){
  const { address } = useAccount();
  const wallet = address?.toLowerCase();

  const { data:summary } = useSWR(wallet ? `${base}/api/merchant/${wallet}/summary` : null, url=>fetch(url).then(r=>r.json()));
  const { data:receipts } = useSWR(wallet ? `${base}/api/merchant/${wallet}/receipts?page=1` : null, url=>fetch(url).then(r=>r.json()));

  const [qrAmount, setQrAmount] = useState("5");
  const [qrToken, setQrToken] = useState("USDC");
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<string | null>(null);

  async function genQR(){
    const res = await axios.post(`${base}/api/merchant/${wallet}/qr`, { amount: qrAmount, token: qrToken });
    setQrImg(res.data.qr);
    setQrLink(res.data.link);
  }

  if (!wallet) return <p style={{padding:24}}>Connect your wallet to view dashboard.</p>;

  return (
    <main style={{maxWidth:980, margin:"0 auto", padding:24}}>
      <h1 style={{fontSize:22, fontWeight:800, marginBottom:16}}>Merchant Dashboard</h1>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16}}>
        <Card title="Total USD">{summary ? `$${summary.totalUSD?.toLocaleString()}` : "—"}</Card>
        <Card title="Transactions">{summary ? summary.txCount : "—"}</Card>
        <Card title="7-day Avg / day">{summary ? `$${avg(summary.last7d).toFixed(2)}` : "—"}</Card>
      </div>

      <div style={{height:260, background:"#fff", border:"1px solid #eee", borderRadius:10, padding:12, marginBottom:16}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={summary?.last7d || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date"/>
            <YAxis/>
            <Tooltip/>
            <Line dataKey="usd" stroke="#000" strokeWidth={2} dot={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <section style={{display:"grid", gridTemplateColumns:"2fr 1fr", gap:16}}>
        <div>
          <h3 style={{fontWeight:700, marginBottom:8}}>Recent Receipts</h3>
          <table style={{width:"100%", borderCollapse:"collapse"}}>
            <thead><tr>
              <Th>Code</Th><Th>Token</Th><Th>Amount</Th><Th>USD</Th><Th>Date</Th>
            </tr></thead>
            <tbody>
              {(receipts?.rows || []).map((r:any)=>(
                <tr key={r.id} style={{borderTop:"1px solid #eee"}}>
                  <Td>{r.code}</Td>
                  <Td>{r.tokenSymbol || (r.token === zero ? "S" : "ERC20")}</Td>
                  <Td>{r.amount}</Td>
                  <Td>{r.usdAtTx ? `$${r.usdAtTx.toFixed(2)}` : "—"}</Td>
                  <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style={{fontWeight:700, marginBottom:8}}>Generate Payment QR</h3>
          <label>Amount</label>
          <input style={input} value={qrAmount} onChange={e=>setQrAmount(e.target.value)} />
          <label style={{marginTop:8}}>Token</label>
          <select style={input} value={qrToken} onChange={e=>setQrToken(e.target.value)}>
            <option value="S">S</option>
            <option value="USDC">USDC</option>
          </select>
          <button style={btn} onClick={genQR}>Generate QR</button>
          {qrImg && (
            <div style={{marginTop:12}}>
              <img src={qrImg} alt="QR" style={{width:200, height:200}}/>
              <div style={{marginTop:8}}><a href={qrLink!} target="_blank">Open deep-link</a></div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

const zero = "0x0000000000000000000000000000000000000000";
const input: React.CSSProperties = { width:"100%", padding:"10px 12px", border:"1px solid #ddd", borderRadius:8, marginTop:6 };
const btn: React.CSSProperties = { marginTop:12, width:"100%", padding:"10px 12px", borderRadius:10, background:"#111", color:"#fff", fontWeight:600 };
const Th = (p:any)=><th style={{textAlign:"left", fontSize:12, color:"#666", padding:"8px 6px"}}>{p.children}</th>;
const Td = (p:any)=><td style={{padding:"10px 6px", fontSize:13}}>{p.children}</td>;
const Card = ({title, children}:{title:string; children:any}) => (
  <div style={{border:"1px solid #eee", borderRadius:10, padding:12, background:"#fff"}}>
    <div style={{fontSize:12, color:"#666"}}>{title}</div>
    <div style={{fontSize:20, fontWeight:800, marginTop:6}}>{children}</div>
  </div>
);
function avg(arr:any[]){ if(!arr||!arr.length) return 0; return arr.reduce((a,b)=>a+(b.usd||0),0)/arr.length; }
