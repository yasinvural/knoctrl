/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function TestComponent() {
  return <button type="button">Ready</button>;
}

describe("component test setup", () => {
  it("renders a React component in JSDOM", () => {
    render(<TestComponent />);

    expect(screen.getByRole("button", { name: "Ready" })).toBeInTheDocument();
  });
});
