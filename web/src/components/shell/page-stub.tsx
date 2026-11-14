export function PageStub({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <h1 className="text-xl leading-tight font-semibold">{title}</h1>
      {children && <p className="mt-2 max-w-prose text-text-2">{children}</p>}
    </main>
  );
}
