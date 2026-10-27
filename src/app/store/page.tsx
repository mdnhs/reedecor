import { redirect } from "next/navigation";

export default function PublicStoreIndexPage() {
  // Direct visitors to the primary showcase 3D storefront
  redirect("/store/demo-merchant-001");
}
