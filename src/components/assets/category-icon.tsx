import { BookOpen, Flower, Frame, Lamp, Leaf, Shapes, Sofa, Table, type LucideIcon } from "lucide-react";
import type { AssetCategoryIcon } from "@/lib/assets/types";

const ICONS: Record<AssetCategoryIcon, LucideIcon> = {
  leaf: Leaf,
  lamp: Lamp,
  frame: Frame,
  sofa: Sofa,
  table: Table,
  flower: Flower,
  book: BookOpen,
  shapes: Shapes,
};

export function CategoryIcon({ icon, className }: { icon: AssetCategoryIcon; className?: string }) {
  const Icon = ICONS[icon] ?? Shapes;
  return <Icon className={className} />;
}
