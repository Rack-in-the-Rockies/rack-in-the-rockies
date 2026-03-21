type SectionHeaderProps = {
  tag: string;
  title: string;
  subtitle?: string;
  light?: boolean;
};

export function SectionHeader({ tag, title, subtitle, light }: SectionHeaderProps) {
  return (
    <div className="text-center mb-8">
      <p className={`text-xs font-semibold tracking-[3px] uppercase mb-2 ${light ? "text-golden" : "text-tangerine"}`}>
        {tag}
      </p>
      <h2 className={`font-display text-3xl font-bold ${light ? "text-white" : "text-text-dark"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-sm max-w-md mx-auto mt-2 leading-relaxed ${light ? "text-white/70" : "text-text-mid"}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
