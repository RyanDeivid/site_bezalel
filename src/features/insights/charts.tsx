import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePreferences } from '@/app/preferences-context';
import { ChartTooltipBox } from '@/components/charts/ChartFrame';

/**
 * Gráficos do Recharts com as regras da casa: marcas finas, extremidades
 * arredondadas de 4px, grade em linha fina sólida e recessiva, um eixo só,
 * tooltip em todas as marcas e texto sempre em tokens de texto.
 */

const axisTick = { fill: 'var(--fg-muted)', fontSize: 12 };

interface BarDatum {
  label: string;
  value: number;
  extra?: { label: string; value: number };
}

export function HorizontalBars({ data, valueLabel, height }: { data: BarDatum[]; valueLabel: string; height?: number }) {
  const { reducedMotion } = usePreferences();
  const h = height ?? Math.max(160, data.length * 34 + 40);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={8}>
        <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
        <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={150} tick={axisTick} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          cursor={{ fill: 'var(--accent-soft)' }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as BarDatum | undefined;
            if (!active || !d) return null;
            return (
              <ChartTooltipBox
                title={d.label}
                rows={[{ label: valueLabel, value: d.value, color: 'var(--chart-bar)' }, ...(d.extra ? [{ label: d.extra.label, value: d.extra.value }] : [])]}
              />
            );
          }}
        />
        <Bar dataKey="value" name={valueLabel} fill="var(--chart-bar)" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={!reducedMotion} animationDuration={900} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

export function TrendLines({ data, series }: { data: Array<Record<string, string | number>>; series: LineSeries[] }) {
  const { reducedMotion } = usePreferences();
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: -8 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="period" tick={axisTick} axisLine={{ stroke: 'var(--chart-grid)' }} tickLine={false} />
        <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltipBox
                title={String(label)}
                rows={series.map((s) => ({ label: s.label, value: Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0), color: s.color }))}
              />
            );
          }}
        />
        <Legend
          verticalAlign="top"
          align="left"
          iconType="plainline"
          wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
          formatter={(value) => <span style={{ color: 'var(--fg-muted)' }}>{value}</span>}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: s.color }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={!reducedMotion}
            animationDuration={1100}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
