"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { netWorthHistory as demoHistory, spendingByCategory as demoSpending } from "@/lib/data";
import type { ChartPoint, SpendingPoint } from "@/lib/types";

const money = (value: number) => `$${value.toLocaleString("en-US")}`;

export function NetWorthChart({ data = demoHistory }: { data?: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 15, right: 8, left: -20, bottom: 0 }}>
        <defs><linearGradient id="moneyGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#264c40" stopOpacity={0.22}/><stop offset="95%" stopColor="#264c40" stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#ebe7de" strokeDasharray="3 5" />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8b8981", fontSize: 12 }} dy={8} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8b8981", fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} domain={["auto", "auto"]} />
        <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ border: 0, borderRadius: 10, boxShadow: "0 8px 24px #22352d1a", fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke="#264c40" strokeWidth={2.5} fill="url(#moneyGradient)" activeDot={{ r: 5, fill: "#264c40", stroke: "#fff", strokeWidth: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SpendingChart({ data = demoSpending }: { data?: SpendingPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart><Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
          {data.map((x) => <Cell key={x.name} fill={x.color} />)}
        </Pie><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ border: 0, borderRadius: 10, fontSize: 12 }} /></PieChart>
      </ResponsiveContainer>
      <div className="donut-label"><strong>{money(total)}</strong><span>spent</span></div>
      <div className="legend">{data.slice(0, 4).map((x) => <span key={x.name}><i style={{ background: x.color }} />{x.name}<b>{total ? Math.round(x.value / total * 100) : 0}%</b></span>)}</div>
    </div>
  );
}

export function AllocationChart({ data }: { data: SpendingPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!data.length) return <div className="empty-state chart-empty"><strong>No holdings yet</strong><p>Sync an investment account to see its allocation.</p></div>;
  return (
    <div className="donut-wrap">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart><Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
          {data.map((item) => <Cell key={item.name} fill={item.color} />)}
        </Pie><Tooltip formatter={(value) => money(Number(value))} contentStyle={{ border: 0, borderRadius: 10, fontSize: 12 }} /></PieChart>
      </ResponsiveContainer>
      <div className="donut-label"><strong>{money(total)}</strong><span>portfolio</span></div>
      <div className="legend">{data.slice(0, 6).map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}<b>{total ? Math.round(item.value / total * 100) : 0}%</b></span>)}</div>
    </div>
  );
}
