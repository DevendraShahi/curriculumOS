import { HeatmapChart } from "@/components/ui/heatmaps";

const DemoHeatmapChart = () => {
  const width = 800;
  const height = 320;

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-4xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <HeatmapChart width={width} height={height} events={true} showCircles={true} />
      </div>
    </div>
  );
};

export { DemoHeatmapChart };
