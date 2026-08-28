import { describe, expect, it } from "vitest";
import { publicRequestOrigin } from "./request-origin";

describe("publicRequestOrigin", () => {
  it("uses the public origin forwarded by Render", () => {
    const request = new Request("https://localhost:10000/auth/callback", {
      headers: {
        host: "localhost:10000",
        "x-forwarded-host": "fuel-cap-1.onrender.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(publicRequestOrigin(request)).toBe("https://fuel-cap-1.onrender.com");
  });

  it("uses the request origin when proxy headers are absent", () => {
    expect(publicRequestOrigin(new Request("http://localhost:3000/auth/callback"))).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects malformed forwarded origins", () => {
    const request = new Request("https://localhost:10000/auth/callback", {
      headers: {
        "x-forwarded-host": "attacker.example/path",
        "x-forwarded-proto": "javascript",
      },
    });

    expect(publicRequestOrigin(request)).toBe("https://localhost:10000");
  });
});
