import { NovaPlatformApp, NovaRouteKey } from "@/components/NovaPlatformApp";

export default async function WorkspaceRoutePage({
  params,
}: {
  params: Promise<{ workspaceId: string; slug?: string[] }>;
}) {
  const { workspaceId, slug } = await params;
  const routePath = (slug && slug.length > 0
    ? slug.join("/")
    : "visao-geral") as NovaRouteKey;

  return (
    <NovaPlatformApp
      initialWorkspaceId={workspaceId}
      initialRoute={routePath}
    />
  );
}
