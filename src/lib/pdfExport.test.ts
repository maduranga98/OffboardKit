import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./firebase", () => import("../test/mocks/firebase"));

const callable = vi.fn();
const httpsCallableSpy = vi.fn((_app: unknown, _name: string) => callable);
vi.mock("firebase/functions", () => ({
  httpsCallable: (app: unknown, name: string) => httpsCallableSpy(app, name),
}));

import { generateAnalyticsPdf, generateKnowledgePdf } from "./pdfExport";

// "PDF\n" base64-encoded — small but recognisable when decoded.
const FAKE_PDF_BASE64 = btoa("PDF\n");

describe("pdfExport", () => {
  let createUrl: ReturnType<typeof vi.fn>;
  let revokeUrl: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    callable.mockReset();
    httpsCallableSpy.mockClear();
    createUrl = vi.fn(() => "blob:fake-url");
    revokeUrl = vi.fn();
    // happy-dom doesn't ship these — point them at spies so we can assert
    // the create→click→revoke download sequence.
    (URL as unknown as { createObjectURL: typeof createUrl }).createObjectURL = createUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeUrl }).revokeObjectURL = revokeUrl;
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  it("generateAnalyticsPdf decodes the response and triggers a download", async () => {
    callable.mockResolvedValueOnce({ data: { pdf: FAKE_PDF_BASE64 } });
    await generateAnalyticsPdf({ companyId: "c1", dateRange: "30d" });
    expect(httpsCallableSpy).toHaveBeenCalledWith(expect.anything(), "generateAnalyticsPdf");
    expect(callable).toHaveBeenCalledWith({ companyId: "c1", dateRange: "30d" });
    expect(createUrl).toHaveBeenCalledTimes(1);
    const [blob] = createUrl.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe("application/pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:fake-url");
  });

  it("generateAnalyticsPdf rethrows when the callable fails", async () => {
    callable.mockRejectedValueOnce(new Error("server-error"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      generateAnalyticsPdf({ companyId: "c1", dateRange: "30d" })
    ).rejects.toThrow("server-error");
    errSpy.mockRestore();
  });

  it("generateKnowledgePdf calls the knowledge endpoint and downloads a PDF blob", async () => {
    callable.mockResolvedValueOnce({ data: { pdf: FAKE_PDF_BASE64 } });
    await generateKnowledgePdf({ companyId: "c1", typeFilter: "video" });
    expect(httpsCallableSpy).toHaveBeenCalledWith(expect.anything(), "generateKnowledgePdf");
    expect(callable).toHaveBeenCalledWith({ companyId: "c1", typeFilter: "video" });
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
});
