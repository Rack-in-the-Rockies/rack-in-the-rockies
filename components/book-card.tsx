import Image from "next/image";
import type { Book } from "@/data/books";

export function BookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-coral/[0.08] shadow-sm transition-transform hover:-translate-y-1 flex flex-col">
      <div className="relative aspect-square bg-cream">
        <Image
          src={book.cover}
          alt={`${book.title} book cover`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>
      <div className="p-4 text-left flex flex-col flex-1">
        <h3 className="font-display text-base text-text-dark mb-0.5">
          {book.title}
        </h3>
        <p className="text-[11px] text-text-light mb-2">by {book.authors}</p>
        <p className="text-xs text-text-mid leading-relaxed mb-3 flex-1">
          {book.description}
        </p>
        <a
          href={book.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-coral text-xs font-semibold hover:underline"
        >
          View on Amazon →
        </a>
      </div>
    </div>
  );
}
