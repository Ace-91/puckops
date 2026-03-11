import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft } from "lucide-react";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

export default function Pricing() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#000" }}>
      <div className="text-center">
        <h1 className="text-4xl font-black text-white mb-3">Pricing</h1>
        <p className="text-gray-500 mb-8">Full pricing page coming soon.</p>
        <Link to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: GOLD }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}