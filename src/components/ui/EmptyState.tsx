export const EmptyState = ({
  title,
  description
}: {
  title: string;
  description: string;
}) => (
  <div className="rounded-[30px] border border-dashed border-border bg-white/90 px-6 py-12 text-center text-slate-600 shadow-card">
    <p className="eyebrow">No Data Yet</p>
    <h3 className="mt-3 text-3xl text-brand-navy">{title}</h3>
    <p className="section-copy mt-3">{description}</p>
  </div>
);
