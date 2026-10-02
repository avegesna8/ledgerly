"use client";

import { useCallback, useState } from "react";
import { Landmark, LoaderCircle, TrendingUp } from "lucide-react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";

type PlaidMode = "bank" | "investment" | "update";

function PlaidLauncher({ token, mode, connectionId, addInvestments, label, onComplete, onReset }: { token:string; mode:PlaidMode; connectionId?:string; addInvestments?:boolean; label:string; onComplete:()=>void; onReset:()=>void }) {
  const [saving,setSaving]=useState(false);
  const onSuccess=useCallback<PlaidLinkOnSuccess>(async(publicToken,metadata)=>{setSaving(true);const response=await fetch("/api/plaid/exchange",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({publicToken,mode,connectionId,addInvestments,institutionName:metadata.institution?.name,selectedAccountIds:metadata.accounts.map(account=>account.id)})});setSaving(false);if(!response.ok){const result=await response.json();alert(result.error??"Could not update this connection.");return onReset();}onComplete();},[addInvestments,connectionId,mode,onComplete,onReset]);
  const {open,ready}=usePlaidLink({token,onSuccess,onExit:()=>onReset()});
  const Icon = mode === "investment" ? TrendingUp : Landmark;
  return <button className="button secondary" disabled={!ready||saving} onClick={()=>open()}>{saving?<LoaderCircle className="spin" size={15}/>:<Icon size={15}/>} {saving?"Saving…":`Open Plaid to ${label.toLowerCase()}`}</button>;
}

export function PlaidConnectButton({ onComplete, mode="bank", connectionId, addInvestments=false, label }: { onComplete:()=>void; mode?:PlaidMode; connectionId?:string; addInvestments?:boolean; label?:string }) {
  const [token,setToken]=useState<string|null>(null); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  const buttonLabel = label ?? (mode === "investment" ? "Connect investment" : mode === "update" ? "Manage accounts" : "Connect bank");
  async function begin(){setLoading(true);setError("");const response=await fetch("/api/plaid/link-token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,connectionId,addInvestments})});const result=await response.json();setLoading(false);if(!response.ok)return setError(result.error??"Could not start Plaid.");setToken(result.linkToken);}
  if(token)return <PlaidLauncher token={token} mode={mode} connectionId={connectionId} addInvestments={addInvestments} label={buttonLabel} onReset={()=>setToken(null)} onComplete={()=>{setToken(null);onComplete();}}/>;
  const Icon = mode === "investment" ? TrendingUp : Landmark;
  return <span className="plaid-button-wrap"><button className="button secondary" disabled={loading} onClick={begin}>{loading?<LoaderCircle className="spin" size={15}/>:<Icon size={15}/>} {buttonLabel}</button>{error&&<small className="connection-error">{error}</small>}</span>;
}
