import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sha256Hex } from "@/lib/nova-auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) {
    redirect("/entrar");
  }

  try {
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

    if (membership) {
      redirect(`/app/${membership.workspaceId}/visao-geral`);
    }
    redirect("/onboarding");
  } catch {
    redirect("/entrar");
  }
}
