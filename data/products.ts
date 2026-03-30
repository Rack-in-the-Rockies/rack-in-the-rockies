export type Store = {
  id: string;
  name: string;
  description: string;
  discountCode?: string;
  discountPercent: number;
  affiliateUrl: string;
  imageGradient: [string, string];
  logo: string;
  logoBg?: "light" | "dark";
};

// Keep Product type for backward compatibility with homepage preview
export type Product = Store & { brand: string; category: string };

export const stores: Store[] = [
  {
    id: "luxe-mahj",
    name: "Luxe Mahj",
    description:
      "Elegant, high-quality tile sets that look as good as they feel. My go-to recommendation for anyone starting out.",
    discountCode: "RITR",
    discountPercent: 10,
    affiliateUrl: "https://luxemahjong.com/",
    imageGradient: ["#FFF0E8", "#FFE4D8"],
    logo: "/stores/luxe-mahj.png",
  },
  {
    id: "charleston-mahjong-club",
    name: "Charleston Mahjong Club",
    description:
      "Vibrant, colorful sets from their beloved cocktail collection. A showstopper at every table.",
    discountPercent: 10,
    affiliateUrl:
      "https://www.charlestonmahjongclub.com/?sca_ref=8310353.xzVKLUEZ8QSn3",
    imageGradient: ["#2D2424", "#3D3030"],
    logo: "/stores/charleston-mahjong-club.png",
    logoBg: "dark",
  },
  {
    id: "peace-love-mahjong",
    name: "Peace Love Mahjong",
    description:
      "Fun, personality-packed sets that bring joy to every game. Peace, love, and mahjong.",
    discountPercent: 10,
    affiliateUrl: "https://peacelovemahjong.com/?ref=ANNEJOHNSON",
    imageGradient: ["#FFE8F0", "#FFD8E4"],
    logo: "/stores/peace-love-mahjong.png",
  },
  {
    id: "miss-mahjong",
    name: "Miss Mahjong",
    description:
      "Timeless design meets modern style. Beautiful sets for any collection.",
    discountPercent: 10,
    affiliateUrl: "https://missmahjong.com/?ref=RITR",
    imageGradient: ["#FFFFFF", "#F8F8F8"],
    logo: "/stores/miss-mahjong.png",
  },
  {
    id: "wren-mats",
    name: "Wren Mats",
    description:
      "Beautiful play mats that protect your table and elevate your entire setup.",
    discountCode: "RITR",
    discountPercent: 10,
    affiliateUrl: "https://www.wrenmats.com/",
    imageGradient: ["#E8FFF0", "#D8FFE4"],
    logo: "/stores/wren-mats.jpg",
  },
];

// Backward-compatible products array for homepage preview
export const products: Product[] = stores.map((s) => ({
  ...s,
  brand: s.name,
  category: "tile-sets",
}));
