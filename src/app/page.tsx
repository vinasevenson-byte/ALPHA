import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureFallbackSessionHydrated, SESSION_COOKIE, sha256Hex } from "@/lib/nova-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) {
    redirect("/entrar");
  }

  try {
    await ensureFallbackSessionHydrated(raw);
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

    const membership = await prisma.membership.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      redirect("/onboarding");
    }

    redirect(`/app/${membership.workspaceId}/visao-geral`);
  } catch {
    redirect("/entrar");
  }
}
