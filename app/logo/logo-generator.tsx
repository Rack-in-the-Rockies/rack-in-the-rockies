"use client";

import { useRef, useState, useCallback } from "react";

const GRADIENTS: Record<string, [string, string]> = {
  "coral-tangerine": ["#FF6B6B", "#FF8E53"],
  "coral-golden": ["#FF6B6B", "#FFC857"],
  "tangerine-golden": ["#FF8E53", "#FFC857"],
};

const WEIGHTS = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "SemiBold" },
  { value: "700", label: "Bold" },
];

const SCALES = [
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x (recommended)" },
  { value: 6, label: "6x (print)" },
];

function getText(textCase: string) {
  const base = "rack in the rockies";
  if (textCase === "title")
    return base.replace(/\b\w/g, (l) => l.toUpperCase());
  if (textCase === "upper") return base.toUpperCase();
  return base;
}

export function LogoGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weight, setWeight] = useState("600");
  const [fontStyle, setFontStyle] = useState<"normal" | "italic">("normal");
  const [fontSize, setFontSize] = useState(72);
  const [scale, setScale] = useState(4);
  const [gradient, setGradient] = useState("coral-tangerine");
  const [textCase, setTextCase] = useState("lower");

  const text = getText(textCase);
  const [c1, c2] = GRADIENTS[gradient];

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scaledSize = fontSize * scale;
    const font = `${fontStyle} ${weight} ${scaledSize}px 'var(--font-playfair)', 'Playfair Display', serif`;

    ctx.font = font;
    const metrics = ctx.measureText(text);
    const w = Math.ceil(metrics.width) + scaledSize;
    const h = Math.ceil(scaledSize * 1.4);

    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.font = font;
    ctx.textBaseline = "middle";

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillText(text, scaledSize / 2, h / 2);

    const link = document.createElement("a");
    link.download = `rack-in-the-rockies-logo-${scale}x.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [fontSize, scale, fontStyle, weight, text, c1, c2]);

  const exportSVG = useCallback(() => {
    const scaledSize = fontSize * 4;
    const w = Math.round(scaledSize * text.length * 0.55) + scaledSize;
    const h = Math.round(scaledSize * 1.4);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <text x="${scaledSize / 2}" y="${h / 2}" dominant-baseline="central"
        font-family="'Playfair Display', serif" font-size="${scaledSize}"
        font-weight="${weight}" font-style="${fontStyle}" fill="url(#g)">
    ${text}
  </text>
</svg>`;

    const link = document.createElement("a");
    link.download = "rack-in-the-rockies-logo.svg";
    link.href =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    link.click();
  }, [fontSize, weight, fontStyle, text, c1, c2]);

  return (
    <>
      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Label text="Font Weight">
          <Select value={weight} onChange={setWeight} options={WEIGHTS} />
        </Label>
        <Label text="Style">
          <Select
            value={fontStyle}
            onChange={(v) => setFontStyle(v as "normal" | "italic")}
            options={[
              { value: "normal", label: "Normal" },
              { value: "italic", label: "Italic" },
            ]}
          />
        </Label>
        <Label text="Preview Size">
          <input
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            min={24}
            max={200}
            step={4}
            className="w-full px-3 py-2 rounded-lg border border-coral/20 bg-white text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-coral/30"
          />
        </Label>
        <Label text="Export Scale">
          <Select
            value={String(scale)}
            onChange={(v) => setScale(Number(v))}
            options={SCALES.map((s) => ({
              value: String(s.value),
              label: s.label,
            }))}
          />
        </Label>
        <Label text="Gradient">
          <Select
            value={gradient}
            onChange={setGradient}
            options={[
              { value: "coral-tangerine", label: "Coral - Tangerine" },
              { value: "coral-golden", label: "Coral - Golden" },
              { value: "tangerine-golden", label: "Tangerine - Golden" },
            ]}
          />
        </Label>
        <Label text="Case">
          <Select
            value={textCase}
            onChange={setTextCase}
            options={[
              { value: "lower", label: "lowercase" },
              { value: "title", label: "Title Case" },
              { value: "upper", label: "UPPERCASE" },
            ]}
          />
        </Label>
      </div>

      {/* Preview */}
      <div className="text-center mb-6">
        <p className="text-xs text-text-light mb-2">
          Preview (checkerboard = transparent)
        </p>
        <div
          className="inline-block rounded-2xl p-8 md:p-12 border border-coral/10"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#e8e0dc 0% 25%, white 0% 50%)",
            backgroundSize: "16px 16px",
          }}
        >
          <span
            className="font-display leading-tight whitespace-nowrap"
            style={{
              fontSize: `${fontSize}px`,
              fontWeight: Number(weight),
              fontStyle,
              backgroundImage: `linear-gradient(135deg, ${c1}, ${c2})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {text}
          </span>
        </div>
      </div>

      <p className="text-center text-xs text-text-light mb-6">
        Export: ~{Math.round(fontSize * text.length * 0.55 * scale)} x{" "}
        {Math.round(fontSize * 1.4 * scale)}px at {scale}x
      </p>

      {/* Export Buttons */}
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={exportPNG}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-coral to-tangerine text-white text-sm font-medium hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          Download PNG
        </button>
        <button
          onClick={exportSVG}
          className="px-6 py-2.5 rounded-full border-2 border-coral text-coral text-sm font-medium hover:bg-blush transition-all cursor-pointer"
        >
          Download SVG
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </>
  );
}

function Label({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-light mb-1">{text}</p>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg border border-coral/20 bg-white text-sm text-text-dark focus:outline-none focus:ring-2 focus:ring-coral/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
