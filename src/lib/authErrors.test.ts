import { describe, it, expect } from "vitest";
import { getAuthErrorCode, getAuthErrorMessage } from "./authErrors";

describe("getAuthErrorCode", () => {
  it("reads the code off a FirebaseError-shaped object", () => {
    expect(getAuthErrorCode({ code: "auth/invalid-credential" })).toBe(
      "auth/invalid-credential"
    );
  });

  it("falls back to parsing the message", () => {
    expect(getAuthErrorCode(new Error("Firebase: Error (auth/expired-action-code)."))).toBe(
      "auth/expired-action-code"
    );
  });

  it("returns null when there is no code", () => {
    expect(getAuthErrorCode(new Error("boom"))).toBeNull();
    expect(getAuthErrorCode("boom")).toBeNull();
  });
});

describe("getAuthErrorMessage", () => {
  it("maps known codes to human-readable copy", () => {
    expect(getAuthErrorMessage({ code: "auth/invalid-credential" })).toBe(
      "Incorrect email or password. Try again or reset your password."
    );
  });

  it("never leaks the raw Firebase string", () => {
    const message = getAuthErrorMessage(new Error("Firebase: Error (auth/unknown-thing)."));
    expect(message).toBe("Something went wrong. Please try again.");
  });

  it("uses the provided fallback for unknown errors", () => {
    expect(getAuthErrorMessage(new Error("boom"), "Sign in failed.")).toBe("Sign in failed.");
  });
});
