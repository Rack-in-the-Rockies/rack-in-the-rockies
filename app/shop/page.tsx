import { products } from "@/data/products";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";
import Link from "next/link";

export const metadata = {
  title: "Shop Mahjong Favorites | Rack in the Rockies",
  description: "Curated mahjong sets, mats, and accessories with exclusive discount codes.",
};

type Props = { searchParams: Promise<{ category?: string }> };

export default async function ShopPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const filtered = category
    ? products.filter((p) => p.category === category)
    : products;

  const categories = [
    { value: "", label: "All" },
    { value: "tile-sets", label: "Tile Sets" },
    { value: "mats", label: "Mats" },
    { value: "accessories", label: "Accessories" },
  ];

  return (
    <main className="py-12 px-6 md:px-12">
      <SectionHeader
        tag="The Shop"
        title="My favorites"
        subtitle="Sets, mats, and accessories I actually use — each with an exclusive discount code."
      />
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {categories.map((c) => (
          <Link
            key={c.value}
            href={c.value ? `/shop?category=${c.value}` : "/shop"}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              (category || "") === c.value
                ? "bg-gradient-to-r from-coral to-tangerine text-white"
                : "bg-white text-text-mid border border-coral/10 hover:border-coral/30"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  );
}
