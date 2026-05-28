"use client";

import React from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { HeatmapCircle, HeatmapRect } from "@visx/heatmap";
import { getSeededRandom } from "@visx/mock-data";

const seededRandom = getSeededRandom(0.41);

interface Bin {
  id: string;
  count: number;
  bin: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  row: number;
  column: number;
}

interface Bins {
  id: string;
  x0: number;
  x1: number;
  bins: Bin[];
}

export type HeatmapCell = {
  dayStartMs: number;
  count: number;
  intensity: number;
};

export type HeatmapChartProps = {
  width: number;
  height: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  separation?: number;
  events?: boolean;
  cells?: HeatmapCell[];
  columns?: number;
  showCircles?: boolean;
};

const defaultMargin = { top: 8, left: 8, right: 8, bottom: 8 };

function max<Datum>(data: Datum[], value: (d: Datum) => number): number {
  return Math.max(...data.map(value));
}

function min<Datum>(data: Datum[], value: (d: Datum) => number): number {
  return Math.min(...data.map(value));
}

function buildHeatmapData(cells: HeatmapCell[] | undefined, columns: number): Bins[] {
  if (!cells || cells.length === 0) {
    const generatedCells: HeatmapCell[] = Array.from({ length: columns * 4 }, (_, index) => ({
      dayStartMs: index,
      count: Math.round(10 * seededRandom()),
      intensity: Math.round(4 * seededRandom()),
    }));

    return buildHeatmapData(generatedCells, columns);
  }

  const safeColumns = Math.max(1, columns);
  const rows = Math.max(1, Math.ceil(cells.length / safeColumns));
  const total = rows * safeColumns;

  const padded: HeatmapCell[] = Array.from({ length: total }, (_, index) => {
    const cell = cells[index];
    return (
      cell ?? {
        dayStartMs: 0,
        count: 0,
        intensity: 0,
      }
    );
  });

  return Array.from({ length: safeColumns }, (_, columnIndex) => {
    const columnBins: Bin[] = Array.from({ length: rows }, (_, rowIndex) => {
      const index = rowIndex * safeColumns + columnIndex;
      const cell = padded[index];
      return {
        id: `${columnIndex}-${rowIndex}`,
        count: cell.count,
        bin: cell.intensity,
        x0: columnIndex,
        x1: columnIndex + 1,
        y0: rowIndex,
        y1: rowIndex + 1,
        row: rowIndex,
        column: columnIndex,
      };
    });

    return {
      id: `col-${columnIndex}`,
      x0: columnIndex,
      x1: columnIndex + 1,
      bins: columnBins,
    };
  });
}

export const HeatmapChart = ({
  width,
  height,
  events = false,
  margin = defaultMargin,
  separation = 12,
  cells,
  columns = 7,
  showCircles = false,
}: HeatmapChartProps) => {
  const binData = React.useMemo(() => buildHeatmapData(cells, columns), [cells, columns]);

  const bins = (d: Bins) => d.bins;
  const intensity = (d: Bin) => d.bin;

  const colorMax = Math.max(1, max(binData, (d) => max(bins(d), intensity)));
  const bucketSizeMax = Math.max(1, max(binData, (d) => bins(d).length));

  const size =
    width > margin.left + margin.right ? width - margin.left - margin.right - separation : width;
  const xMax = Math.max(1, showCircles ? size / 2 : size);
  const yMax = Math.max(1, height - margin.bottom - margin.top);
  const columnsCount = Math.max(1, binData.length);
  const rowsCount = Math.max(1, bucketSizeMax);
  const squareSize = min([xMax / columnsCount, yMax / rowsCount], (d) => d);
  const gridWidth = columnsCount * squareSize;
  const gridHeight = rowsCount * squareSize;
  const radius = squareSize / 2;

  const xScale = scaleLinear<number>({
    domain: [0, binData.length],
    range: [0, gridWidth],
  });

  const yScale = scaleLinear<number>({
    domain: [0, bucketSizeMax],
    range: [gridHeight, 0],
  });

  // Blue-first palette to match curriculum.os accent system in both themes.
  const circleColorScale = scaleLinear<string>({
    range: ["#1d4ed8", "#0077ff"],
    domain: [0, colorMax],
  });

  const rectColorScale = scaleLinear<string>({
    range: ["#1e293b", "#0077ff"],
    domain: [0, colorMax],
  });

  const opacityScale = scaleLinear<number>({
    range: [0.16, 1],
    domain: [0, colorMax],
  });

  if (width < 10) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weekly progress heatmap">
      {showCircles ? (
        <Group top={margin.top} left={margin.left}>
          <HeatmapCircle
            data={binData}
            xScale={(d) => xScale(d) ?? 0}
            yScale={(d) => yScale(d) ?? 0}
            colorScale={circleColorScale}
            opacityScale={opacityScale}
            radius={radius}
            gap={2}
          >
            {(heatmap) =>
              heatmap.map((heatmapBins) =>
                heatmapBins.map((bin) => (
                  <circle
                    key={`heatmap-circle-${bin.row}-${bin.column}`}
                    cx={bin.cx}
                    cy={bin.cy}
                    r={bin.r}
                    fill={bin.color}
                    fillOpacity={bin.opacity}
                    onClick={() => {
                      if (!events) return;
                      const { row, column } = bin;
                      alert(JSON.stringify({ row, column, bin: bin.bin }));
                    }}
                  />
                ))
              )
            }
          </HeatmapCircle>
        </Group>
      ) : null}

      <Group top={margin.top} left={showCircles ? xMax + margin.left + separation : margin.left}>
        <HeatmapRect
          data={binData}
          xScale={(d) => xScale(d) ?? 0}
          yScale={(d) => yScale(d) ?? 0}
          colorScale={rectColorScale}
          opacityScale={opacityScale}
          binWidth={squareSize}
          binHeight={squareSize}
          gap={2}
        >
          {(heatmap) =>
            heatmap.map((heatmapBins) =>
              heatmapBins.map((bin) => (
                <rect
                  key={`heatmap-rect-${bin.row}-${bin.column}`}
                  width={bin.width}
                  height={bin.height}
                  x={bin.x}
                  y={bin.y}
                  fill={bin.color}
                  fillOpacity={bin.opacity}
                  onClick={() => {
                    if (!events) return;
                    const { row, column } = bin;
                    alert(JSON.stringify({ row, column, bin: bin.bin }));
                  }}
                />
              ))
            )
          }
        </HeatmapRect>
      </Group>
    </svg>
  );
};
