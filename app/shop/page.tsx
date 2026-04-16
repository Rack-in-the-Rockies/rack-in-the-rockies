import { stores } from "@/data/products";
import { books } from "@/data/books";
import { ProductCard } from "@/components/product-card";
import { BookCard } from "@/components/book-card";
import { SectionHeader } from "@/components/section-header";

export const metadata = {
  title: "Shop Mahjong Favorites | Rack in the Rockies",
  description:
    "Our favorite mahjong stores and books — sets, mats, accessories, and reads with exclusive discount codes.",
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

      <div className="mt-20">
        <SectionHeader
          tag="Books"
          title="Books we love"
          subtitle="Mahjong stories for every table and every generation."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </main>
  );
}
