import Link from "next/link";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  external?: boolean;
};

export function PrimaryButton({ href, children, className = "", external }: ButtonProps) {
  const styles =
    "inline-block bg-gradient-to-r from-coral to-tangerine text-white px-7 py-3 rounded-pill text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-coral/30 " +
    className;
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={styles}>{children}</a>;
  }
  return <Link href={href} className={styles}>{children}</Link>;
}

export function SecondaryButton({ href, children, className = "" }: ButtonProps) {
  return (
    <Link
      href={href}
      className={
        "inline-block border-2 border-coral text-coral px-7 py-2.5 rounded-pill text-sm font-semibold transition-all hover:bg-coral hover:text-white " +
        className
      }
    >
      {children}
    </Link>
  );
}
