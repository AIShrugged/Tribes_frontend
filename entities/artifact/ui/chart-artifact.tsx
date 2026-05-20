'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ChartArtifact } from '@/entities/artifact/model/types';

const CHART_COLORS = [
  'hsl(142 47% 45%)', // primary green
  'hsl(217 91% 60%)', // blue
  'hsl(45 93% 58%)', // amber
  'hsl(0 84% 60%)', // red
  'hsl(280 68% 60%)', // violet
];

export function ChartArtifactView({ data }: { data: ChartArtifact['data'] }) {
  const chartData = data.labels.map((label, i) => {
    const point: Record<string, string | number> = { label };

    for (const ds of data.datasets) {
      point[ds.label] = ds.data[i] ?? 0;
    }

    return point;
  });
  const sharedProps = {
    data: chartData,
    margin: { top: 4, right: 4, left: -16, bottom: 0 },
  };
  const axes = (
    <>
      <CartesianGrid strokeDasharray='3 3' stroke='hsl(240 5.9% 90%)' />
      <XAxis
        dataKey='label'
        tick={{ fontSize: 11, fill: 'hsl(240 3.8% 46.1%)' }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 11, fill: 'hsl(240 3.8% 46.1%)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          background: 'hsl(0 0% 100%)',
          border: '1px solid hsl(240 5.9% 90%)',
          borderRadius: '6px',
          fontSize: 12,
        }}
      />
      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
    </>
  );

  if (data.chart_type === 'line') {
    return (
      <ResponsiveContainer width='100%' height={200}>
        <LineChart {...sharedProps}>
          {axes}
          {data.datasets.map((ds, i) => {
            return (
              <Line
                key={ds.label}
                type='monotone'
                dataKey={ds.label}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (data.chart_type === 'pie') {
    const pieData = data.labels.map((label, i) => {
      return {
        name: label,
        value: data.datasets[0]?.data[i] ?? 0,
      };
    });

    return (
      <ResponsiveContainer width='100%' height={200}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey='value'
            nameKey='name'
            cx='50%'
            cy='50%'
            outerRadius={80}
          >
            {pieData.map((_, i) => {
              return (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              );
            })}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'hsl(0 0% 100%)',
              border: '1px solid hsl(240 5.9% 90%)',
              borderRadius: '6px',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // default: bar
  return (
    <ResponsiveContainer width='100%' height={200}>
      <BarChart {...sharedProps} barGap={2}>
        {axes}
        {data.datasets.map((ds, i) => {
          return (
            <Bar
              key={ds.label}
              dataKey={ds.label}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[3, 3, 0, 0]}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
  );
}
