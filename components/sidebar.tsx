"use client";

import { BarChart3, CircleDollarSign, CreditCard, Inbox, LayoutDashboard, PieChart, Settings, TrendingUp, WalletCards } from "lucide-react";

const links = [
  ["Overview", LayoutDashboard], ["Money flow", CircleDollarSign], ["Transactions", CreditCard],
  ["Investments", TrendingUp], ["Analytics", BarChart3], ["Budgets", PieChart], ["Needs review", Inbox],
] as const;

export function Sidebar({ active, onNavigate, reviewCount = 0 }: { active: string; onNavigate: (page: string) => void; reviewCount?: number }) {
  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => onNavigate("Overview")} aria-label="Go to overview">
        <span className="brand-mark"><WalletCards size={19} /></span>
        <span>Ledgerly</span>
      </button>
      <nav aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {links.map(([label, Icon]) => (
          <button className={`nav-item ${active === label ? "active" : ""}`} key={label} onClick={() => onNavigate(label)}>
            <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
            {label === "Needs review" && reviewCount > 0 && <span className="badge">{reviewCount}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => onNavigate("Settings")}><Settings size={18} /> Settings</button>
        <div className="profile">
          <span className="avatar">AV</span>
          <span><strong>Abhinn V.</strong><small>Personal workspace</small></span>
          <button aria-label="Profile options">•••</button>
        </div>
      </div>
    </aside>
  );
}
