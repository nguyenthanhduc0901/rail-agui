import { Rajdhani, Sora } from "next/font/google";

import { RailDashboardApp } from "@/features/rail-dashboard/RailDashboardApp";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function RailDashboardPage() {
  return (
    <div
      className="h-full"
      style={{
        "--font-display": rajdhani.style.fontFamily,
        "--font-sans": sora.style.fontFamily,
      }}
    >
      <RailDashboardApp />
    </div>
  );
}
