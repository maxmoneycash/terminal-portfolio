import { test } from "node:test";
import assert from "node:assert/strict";
import { frameMode, probe, selectedApps } from "./check-live-apps.mjs";

test("showcase excludes removed projects and upstream forks", () => {
  for (const id of ["SeamMoney/cash-clicker", "maxmoneycash/protocol-v2", "maxmoneycash/commerce"]) assert.ok(!selectedApps.includes(id));
});
test("frame restrictions use the external browser", () => {
  assert.equal(frameMode(new Headers({ "x-frame-options": "DENY" })), "external");
  assert.equal(frameMode(new Headers({ "content-security-policy": "frame-ancestors 'none'" })), "external");
  assert.equal(frameMode(new Headers()), "embed");
});
test("HTTP failures, authentication redirects and network failures never become live apps", async () => {
  const response = (ok, url) => async () => ({ ok, url, headers: new Headers() });
  assert.equal((await probe("https://example.com", response(false, "https://example.com"))).available, false);
  assert.equal((await probe("https://example.com", response(true, "https://vercel.com/login?next=test"))).available, false);
  assert.equal((await probe("https://example.com", async () => { throw new Error("offline"); })).available, false);
  assert.equal((await probe("https://example.com", response(true, "https://example.com"))).available, true);
});
