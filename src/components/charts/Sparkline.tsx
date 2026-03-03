import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

export const Sparkline = ({
  values,
  color = "#2563eb"
}: {
  values: number[];
  color?: string;
}) => {
  const points = values.map((value, index) => ({ index, value }));

  if (!points.length) {
    return <div className="h-16 rounded-lg bg-slate-100" />;
  }

  return (
    <div className="h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 2 }}>
          <Tooltip formatter={(value) => Number(value).toFixed(2)} labelFormatter={() => ""} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.16}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
