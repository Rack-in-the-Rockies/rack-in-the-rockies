import type { Metadata } from "next";
import { LogoGenerator } from "./logo-generator";

export const metadata: Metadata = {
  title: "Logo Generator | Rack in the Rockies",
  description:
    "Generate high-resolution Rack in the Rockies logos for email signatures and marketing materials.",
};

export default function LogoPage() {
  return (
    <main className="py-12 px-6 md:px-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs font-body font-medium tracking-widest uppercase text-coral mb-2">
            Brand Tools
          </p>
          <h1 className="font-display text-3xl md:text-4xl text-text-dark mb-3">
            Logo Generator
          </h1>
          <p className="text-text-mid text-sm max-w-md mx-auto">
            Export high-resolution logos with transparent backgrounds for email
            signatures, social media, and marketing materials.
          </p>
        </div>
        <LogoGenerator />
      </div>
    </main>
  );
}
