import Link from "next/link";

// Canonical control classes for apps/wagebook — see
// .claude/skills/plutus-button-nav-system/SKILL.md for the full spec.
// One Button component, five variants, three sizes. No hand-typed
// className strings at call sites: ConfirmActionButton and
// FormSubmitButton build on the same buttonClasses() so every row
// action and form submit in the app shares this one source of truth.
export type ButtonVariant = "primary" | "secondary" | "quiet" | "row" | "danger";
export type ButtonSize = "lg" | "md" | "row";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white border border-primary hover:bg-primary-dark hover:border-primary-dark",
  secondary: "bg-surface text-ink border border-border hover:bg-bg hover:border-ink-soft",
  quiet: "bg-transparent text-ink-soft border border-transparent hover:bg-bg hover:text-ink",
  row: "bg-transparent text-primary border border-transparent hover:bg-primary-tint",
  danger: "bg-surface text-bad border border-bad hover:bg-bad-tint",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  lg: "px-6 py-[14px]",
  md: "px-[22px] py-3",
  row: "px-3 py-[9px]",
};

const BASE_CLASSES =
  "rounded-button font-extrabold text-[13px] leading-[18px] whitespace-nowrap disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function buttonClasses(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean): string {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth ? "w-full" : ""]
    .filter(Boolean)
    .join(" ");
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<React.ComponentProps<typeof Link>, "className"> & { href: React.ComponentProps<typeof Link>["href"] };

export function Button({ variant = "primary", size = "lg", fullWidth, children, ...rest }: ButtonAsButton | ButtonAsLink) {
  const classes = buttonClasses(variant, size, fullWidth);

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classes} {...linkRest}>
        {children}
      </Link>
    );
  }

  const buttonRest = rest as Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">;
  return (
    <button type={buttonRest.type ?? "button"} className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
