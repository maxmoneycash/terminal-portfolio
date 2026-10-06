import { test } from "node:test";
import assert from "node:assert/strict";
import { publicGithub, publicRepository } from "./fetch-github-projects.mjs";

const repo = {
  private: false, visibility: "public", owner: { login: "example" },
  name: "public-app", description: "Exact public description", homepage: "https://example.com",
  html_url: "https://github.com/example/public-app", pushed_at: "2026-01-01T00:00:00Z",
  language: "TypeScript", fork: false, archived: false, stargazers_count: 2, forks_count: 0,
};

test("private, internal, or unknown visibility fails closed", () => {
  for (const change of [{ private: true }, { visibility: "private" }, { visibility: "internal" }, { private: undefined }, { visibility: undefined }]) {
    assert.throws(() => publicRepository({ ...repo, ...change }), /non-public/);
  }
});

test("public names and descriptions are exact; extra response fields are excluded", () => {
  const result = publicRepository({ ...repo, secret_scanning: "do-not-publish", permissions: { admin: true } });
  assert.equal(result.name, repo.name);
  assert.equal(result.description, repo.description);
  assert.equal(result.url, repo.html_url);
  assert.ok(!JSON.stringify(result).includes("do-not-publish"));
  assert.ok(!("permissions" in result));
});

test("unsafe deployment URL schemes are not published", () => {
  for (const homepage of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
    assert.equal(publicRepository({ ...repo, homepage }).homepage, null);
  }
});

test("GitHub requests are anonymous even when token environment variables exist", async () => {
  const before = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "test-only-never-send";
  try {
    await publicGithub("users/example/repos", async (url, options) => {
      assert.equal(url, "https://api.github.com/users/example/repos");
      assert.ok(!Object.keys(options.headers).some((key) => key.toLowerCase() === "authorization"));
      assert.ok(!JSON.stringify(options).includes("test-only-never-send"));
      return { ok: true, json: async () => [] };
    });
    await assert.rejects(publicGithub("users/example/repos", async () => ({ ok: false, status: 403 })), /403/);
  } finally {
    if (before === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = before;
  }
});
