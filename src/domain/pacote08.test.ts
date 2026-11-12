import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

describe("NOVA Pacote 08 + Pacote 09 — Middleware HTTP Basic, Autenticação Real e Política de Escrita", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("delega acesso diretamente à autenticação de sessão (/entrar) quando NOVA_PREVIEW_USER/PASSWORD não estão definidos", () => {
    delete process.env.NOVA_PREVIEW_USER;
    delete process.env.NOVA_PREVIEW_PASSWORD;
    const req = new NextRequest("https://alpha-kilw.vercel.app/");
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Robots-Tag")).toContain("noindex");
  });

  it("bloqueia com 503 quando credenciais Basic estão incompletas ou senha curta (< 20 chars)", () => {
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "curta";
    const req = new NextRequest("https://alpha-kilw.vercel.app/app/ws-nova-pf");
    const res = middleware(req);
    expect(res.status).toBe(503);
  });

  it("permite abertura em VERCEL_ENV=production mediante HTTP Basic válido quando configurado", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const basic = Buffer.from(
      `${process.env.NOVA_PREVIEW_USER}:${process.env.NOVA_PREVIEW_PASSWORD}`
    ).toString("base64");

    const unauthRes = middleware(new NextRequest("https://alpha-kilw.vercel.app/"));
    expect(unauthRes.status).toBe(401);

    const authRes = middleware(
      new NextRequest("https://alpha-kilw.vercel.app/", {
        headers: { Authorization: `Basic ${basic}` },
      })
    );
    expect(authRes.status).toBe(200);
  });

  it("exige Basic Auth (401) quando configurado e credenciais não são enviadas", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const req = new NextRequest("https://alpha-kilw.vercel.app/");
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic realm");
  });

  it("bloqueia operações POST financeiras em /api/platform com 403 READ_ONLY_HOMOLOGATION quando NOVA_ENABLE_FINANCIAL_WRITES === 'false'", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    process.env.NOVA_ENABLE_FINANCIAL_WRITES = "false";
    const basic = Buffer.from(
      `${process.env.NOVA_PREVIEW_USER}:${process.env.NOVA_PREVIEW_PASSWORD}`
    ).toString("base64");

    const postReq = new NextRequest("https://alpha-kilw.vercel.app/api/platform", {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
    const postRes = middleware(postReq);
    expect(postRes.status).toBe(403);
    const body = await postRes.json();
    expect(body.code).toBe("READ_ONLY_HOMOLOGATION");
  });

  it("permite POST em /api/auth/* (login, cadastro, logout) e no assistente somente-leitura /v1/workspaces/:id/assistant/query mesmo em modo somente-leitura", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    process.env.NOVA_ENABLE_FINANCIAL_WRITES = "false";
    const basic = Buffer.from(
      `${process.env.NOVA_PREVIEW_USER}:${process.env.NOVA_PREVIEW_PASSWORD}`
    ).toString("base64");

    const loginRes = middleware(
      new NextRequest("https://alpha-kilw.vercel.app/api/auth/login", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}` },
      })
    );
    expect(loginRes.status).toBe(200);

    const assistantRes = middleware(
      new NextRequest("https://alpha-kilw.vercel.app/v1/workspaces/ws-123/assistant/query", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}` },
      })
    );
    expect(assistantRes.status).toBe(200);
  });

  it("libera POST em /api/platform no middleware quando escritas não estão bloqueadas (delegando RBAC/sessão à rota)", () => {
    delete process.env.NOVA_PREVIEW_USER;
    delete process.env.NOVA_PREVIEW_PASSWORD;
    delete process.env.NOVA_ENABLE_FINANCIAL_WRITES;

    const postRes = middleware(
      new NextRequest("https://alpha-kilw.vercel.app/api/platform", {
        method: "POST",
      })
    );
    expect(postRes.status).toBe(200);
  });
});
