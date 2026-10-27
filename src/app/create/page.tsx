import Link from "next/link";
import { ArrowRight, Images, Image as ImageIcon } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

const OPTIONS = [
  {
    href: "/create/single",
    title: "Single image",
    detail: "One clean photo. Fastest and cheapest option.",
    icon: ImageIcon,
  },
  {
    href: "/create/multi",
    title: "Multi-angle",
    detail: "Front, back, left and right photos for fuller geometry.",
    icon: Images,
  },
];

export default function CreateChooserPage() {
  return (
    <DashboardLayout title="Create 3D Model" subtitle="Choose how you want to capture your product">
      <div className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ href, title, detail, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs transition-shadow hover:shadow-md"
          >
            <Icon className="h-6 w-6 text-amber-600" />
            <div>
              <h2 className="text-base font-bold text-stone-900">{title}</h2>
              <p className="mt-1 text-xs text-stone-500">{detail}</p>
            </div>
            <ArrowRight className="h-4 w-4 self-end text-stone-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </DashboardLayout>
  );
}
