import type { Product } from "@/data/products";

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-coral/[0.08] shadow-sm transition-transform hover:-translate-y-1">
      <div
        className="h-40 flex items-center justify-center text-4xl relative"
        style={{
          background: `linear-gradient(135deg, ${product.imageGradient[0]}, ${product.imageGradient[1]})`,
        }}
      >
        <span>{product.emoji}</span>
        {product.discountPercent > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-gradient-to-r from-coral to-tangerine text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            {product.discountPercent}% OFF
          </span>
        )}
      </div>
      <div className="p-4 text-left">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-tangerine mb-0.5">
          {product.brand}
        </p>
        <h3 className="font-display text-base text-text-dark mb-1.5">{product.name}</h3>
        <p className="text-xs text-text-mid leading-relaxed mb-3">{product.description}</p>
        {product.discountCode && (
          <p className="text-[10px] text-text-light mb-2">
            Use code: <span className="font-semibold text-coral">{product.discountCode}</span>
          </p>
        )}
        <a
          href={product.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-coral text-xs font-semibold hover:underline"
        >
          Shop Now →
        </a>
      </div>
    </div>
  );
}
