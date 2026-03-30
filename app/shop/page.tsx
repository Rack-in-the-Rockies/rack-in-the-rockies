import { stores } from "@/data/products";
import { ProductCard } from "@/components/product-card";
import { SectionHeader } from "@/components/section-header";

export const metadata = {
  title: "Shop Mahjong Favorites | Rack in the Rockies",
  description:
    "Our favorite mahjong stores — sets, mats, and accessories with exclusive discount codes.",
};

export default function ShopPage() {
  return (
    <main className="py-12 px-6 md:px-12">
      <SectionHeader
        tag="The Shop"
        title="Stores I love"
        subtitle="These are the brands I personally use and recommend. Browse their collections and find something you love."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {stores.map((store) => (
          <ProductCard key={store.id} product={store} />
        ))}
      </div>
    </main>
  );
}
