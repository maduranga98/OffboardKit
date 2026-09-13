import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AutoTextarea } from "./AutoTextarea";

/** happy-dom has no layout engine, so scrollHeight is stubbed per-element. */
function stubScrollHeight(el: HTMLElement, value: number) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => value,
  });
}

afterEach(cleanup);

describe("AutoTextarea", () => {
  // Regression: question text used to live in a single-line <input>, which
  // clipped anything longer than the field without any way to see the rest.
  it("renders a textarea, not a single-line input", () => {
    render(<AutoTextarea aria-label="Question" value="Why are you leaving?" readOnly />);
    expect(screen.getByLabelText("Question").tagName).toBe("TEXTAREA");
  });

  it("keeps the full value addressable however long it is", () => {
    const long = "What factors contributed most to your decision to leave your position as Sales Manager?";
    render(<AutoTextarea aria-label="Question" value={long} readOnly />);
    expect(screen.getByLabelText("Question")).toHaveValue(long);
  });

  it("grows to its content height", () => {
    const { rerender } = render(
      <AutoTextarea aria-label="Question" value="short" readOnly />
    );
    const el = screen.getByLabelText("Question");
    stubScrollHeight(el, 72);
    rerender(<AutoTextarea aria-label="Question" value="a much longer question" readOnly />);
    expect(el.style.height).toBe("72px");
  });

  it("leaves the height alone while it has no layout", () => {
    const { rerender } = render(
      <AutoTextarea aria-label="Question" value="short" readOnly />
    );
    const el = screen.getByLabelText("Question");
    stubScrollHeight(el, 0);
    rerender(<AutoTextarea aria-label="Question" value="collapsed" readOnly />);
    expect(el.style.height).toBe("auto");
  });
});
