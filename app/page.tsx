import { AppShell } from "@/components/app-shell";
import { getDashboardData } from "@/lib/finance-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  return <AppShell {...data}/>;
}
