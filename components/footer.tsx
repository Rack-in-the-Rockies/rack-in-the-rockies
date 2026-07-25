import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter-signup";

type FooterLink = { href: string; label: string; external?: boolean };

const columns: { title: string; links: FooterLink[] }[] = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All Products" },
      { href: "/shop?category=tile-sets", label: "Tile Sets" },
      { href: "/shop?category=mats", label: "Mats" },
      { href: "/shop?category=accessories", label: "Accessories" },
    ],
  },
  {
    title: "Experience",
    links: [
      { href: "/events", label: "Events" },
      { href: "/learn", label: "Learn" },
      { href: "/about", label: "About" },
    ],
  },
  {
    title: "Connect",
    links: [
      { href: "/contact", label: "Contact" },
      {
        href: "https://instagram.com/rackintherockies2026",
        label: "Instagram",
        external: true,
      },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#2D2424] text-white/70 px-6 md:px-12 pt-10 pb-6">
      <div className="max-w-5xl mx-auto pb-8 mb-8 border-b border-white/10">
        <NewsletterSignup light />
      </div>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <p className="font-display text-lg font-bold text-coral mb-2">
            rack in the <span className="text-tangerine">rockies</span>
          </p>
          <p className="text-xs leading-relaxed">
            Curated mahjong experiences from Denver, Colorado.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11px] font-semibold tracking-widest uppercase text-white mb-3">
              {col.title}
            </h4>
            <ul className="space-y-1.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    {...(link.external
                      ? { target: "_blank", rel: "noopener" }
                      : {})}
                    className="text-xs text-white/60 hover:text-coral transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-5xl mx-auto mt-6 pt-4 border-t border-white/10 flex justify-between text-[11px] text-white/40">
        <span>&copy; 2026 Rack in the Rockies</span>
        <span>Denver, Colorado</span>
      </div>
    </footer>
  );
}
