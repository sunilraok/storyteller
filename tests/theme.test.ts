import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme, THEME_INIT_SCRIPT } from "@/lib/theme";

describe("theme preference", () => {
  it("cycles Auto → Light → Dark → Auto", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });

  it("treats anything but light/dark as Auto", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("purple")).toBe("system");
  });

  it("init script applies only a saved light/dark choice and survives storage errors", () => {
    const attrs: Record<string, string> = {};
    const run = (storage: { getItem: (k: string) => string | null }) => {
      const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
      new Function("localStorage", "document", THEME_INIT_SCRIPT)(storage, document);
    };
    run({ getItem: () => "dark" });
    expect(attrs["data-theme"]).toBe("dark");
    delete attrs["data-theme"];
    run({ getItem: () => "system" });
    expect(attrs["data-theme"]).toBeUndefined();
    expect(() =>
      run({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
