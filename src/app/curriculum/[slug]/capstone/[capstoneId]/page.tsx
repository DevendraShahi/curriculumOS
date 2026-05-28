import { CapstoneRuntimeClient } from "@/components/curriculum/CapstoneRuntimeClient";

export default async function CapstonePage({
  params,
}: {
  params: Promise<{ slug: string; capstoneId: string }>;
}) {
  const { slug, capstoneId } = await params;

  return <CapstoneRuntimeClient slug={slug} capstoneId={capstoneId} />;
}
