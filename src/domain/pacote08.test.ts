import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

describe("NOVA Pacote 08 — Middleware de Proteção Preview e Bloqueio de Escrita", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("bloqueia com 503 quando credenciais de Preview estão ausentes ou curtas (< 20 chars)", () => {
    delete process.env.NOVA_PREVIEW_USER;
    delete process.env.NOVA_PREVIEW_PASSWORD;
    const req = new NextRequest("https://nova-preview.vercel.app/app/ws-nova-pf");
    const res = middleware(req);
    expect(res.status).toBe(503);
  });

  it("bloqueia com 503 quando VERCEL_ENV é production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const req = new NextRequest("https://nova.vercel.app/");
    const res = middleware(req);
    expect(res.status).toBe(503);
  });

  it("exige Basic Auth (401) quando credenciais não são enviadas", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const req = new NextRequest("https://nova-preview.vercel.app/");
    const res = middleware(req);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Basic realm");
  });

  it("bloqueia operações POST em /api/* e /v1/* com 403 PREVIEW_READ_ONLY mesmo autenticado no Basic Auth", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const basic = Buffer.from(
      `${process.env.NOVA_PREVIEW_USER}:${process.env.NOVA_PREVIEW_PASSWORD}`
    ).toString("base64");

    const postReq = new NextRequest("https://nova-preview.vercel.app/api/platform", {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
    const postRes = middleware(postReq);
    expect(postRes.status).toBe(403);
    const body = await postRes.json();
    expect(body.code).toBe("PREVIEW_READ_ONLY");
  });

  it("permite GET autenticado e aplica cabeçalhos noindex e no-store", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.NOVA_PREVIEW_USER = "nova-homologacao";
    process.env.NOVA_PREVIEW_PASSWORD = "senha-extremamente-longa-para-homologacao-2026";
    const basic = Buffer.from(
      `${process.env.NOVA_PREVIEW_USER}:${process.env.NOVA_PREVIEW_PASSWORD}`
    ).toString("base64");

    const getReq = new NextRequest("https://nova-preview.vercel.app/api/platform", {
      method: "GET",
      headers: { Authorization: `Basic ${basic}` },
    });
    const getRes = middleware(getReq);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getRes.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});
