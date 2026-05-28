import { ProjectRuntimeClient } from "@/components/curriculum/ProjectRuntimeClient";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;

  return <ProjectRuntimeClient slug={slug} projectId={projectId} />;
}
