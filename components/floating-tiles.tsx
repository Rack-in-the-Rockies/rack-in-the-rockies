const tiles = [
  { emoji: "🀄", className: "top-[12%] left-[10%] animate-[float1_6s_ease-in-out_infinite]" },
  { emoji: "🎋", className: "top-[20%] right-[12%] animate-[float2_7s_ease-in-out_infinite]" },
  { emoji: "🌸", className: "bottom-[15%] left-[15%] animate-[float3_5s_ease-in-out_infinite]" },
  { emoji: "🀙", className: "bottom-[25%] right-[10%] animate-[float1_8s_ease-in-out_infinite]" },
];

export function FloatingTiles() {
  return (
    <>
      {tiles.map((tile, i) => (
        <div
          key={i}
          className={`absolute w-11 h-[58px] bg-white/70 border-2 border-coral/15 rounded-lg flex items-center justify-center text-xl shadow-lg z-[1] ${tile.className}`}
        >
          {tile.emoji}
        </div>
      ))}
    </>
  );
}
