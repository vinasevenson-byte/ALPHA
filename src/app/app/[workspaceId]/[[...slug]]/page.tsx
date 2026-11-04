import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sha256Hex } from "@/lib/nova-auth";
import { NovaPlatformApp, NovaRouteKey } from "@/components/NovaPlatformApp";

export default async function WorkspaceRoutePage({
  params,
}: {
  params: Promise<{ workspaceId: string; slug?: string[] }>;
}) {
  const { workspaceId, slug } = await params;
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) redirect("/entrar");

  const session = await prisma.novaSession.findUnique({
    where: { tokenHash: sha256Hex(raw) },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  ) {
    redirect("/entrar");
  }

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership || membership.status !== "ACTIVE") {
    redirect("/entrar");
  }

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
