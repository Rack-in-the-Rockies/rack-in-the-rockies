export type Product = {
  id: string;
  name: string;
  brand: string;
  category: "tile-sets" | "mats" | "accessories";
  description: string;
  discountCode?: string;
  discountPercent: number;
  affiliateUrl: string;
  imageGradient: [string, string];
  emoji: string;
};

export const products: Product[] = [
  {
    id: "luxe-mahj-country-club",
    name: "Country Club Set",
    brand: "Luxe Mahj",
    category: "tile-sets",
    description:
      "Elegant tiles that look as good as they feel. My go-to for game night.",
    discountCode: "RITR",
    discountPercent: 10,
    affiliateUrl: "#",
    imageGradient: ["#FFF0E8", "#FFE4D8"],
    emoji: "🀄",
  },
  {
    id: "cmc-cocktail-line",
    name: "Cocktail Line Set",
    brand: "Charleston Mahjong Club",
    category: "tile-sets",
    description:
      "Vibrant sets from CMC's beloved cocktail collection. A showstopper at every table.",
    discountPercent: 10,
    affiliateUrl: "#",
    imageGradient: ["#F0E8FF", "#E4D8FF"],
    emoji: "🎴",
  },
  {
    id: "peace-love-mahjong",
    name: "Signature Set",
    brand: "Peace Love Mahjong",
    category: "tile-sets",
    description:
      "Fun, colorful sets that bring personality to every game. Peace, love, and mahjong.",
    discountPercent: 10,
    affiliateUrl: "#",
    imageGradient: ["#FFE8F0", "#FFD8E4"],
    emoji: "🌸",
  },
  {
    id: "miss-mahjong",
    name: "Classic Set",
    brand: "Miss Mahjong",
    category: "tile-sets",
    description:
      "Timeless design meets modern style. A beautiful addition to any collection.",
    discountPercent: 10,
    affiliateUrl: "#",
    imageGradient: ["#E8F0FF", "#D8E4FF"],
    emoji: "🎋",
  },
  {
    id: "wren-mats-premium",
    name: "Premium Play Mat",
    brand: "Wren Mats",
    category: "mats",
    description:
      "Beautiful mats that protect your table and elevate your setup.",
    discountCode: "RITR",
    discountPercent: 10,
    affiliateUrl: "#",
    imageGradient: ["#E8FFF0", "#D8FFE4"],
    emoji: "🎋",
  },
];
