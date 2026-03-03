export const EmptyState = ({
  title,
  description
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center text-slate-600">
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    <p className="mt-2 text-sm">{description}</p>
  </div>
);
