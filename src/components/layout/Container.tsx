/** Standard page container for the app (non-landing) routes. */
export function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-24">{children}</div>;
}
