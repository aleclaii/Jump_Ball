// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { state } from "../data/state";
import { attachChoicePicker } from "./choicePicker";

/** A name box like the ones on the matchup card, showing Panda Express with Subway on the other side. */
function setUp() {
  document.body.innerHTML = `<div class="side-main"><input class="name-in" value="Panda Express"></div>`;
  const input = document.querySelector<HTMLInputElement>("input")!;
  const picked: string[] = [];
  attachChoicePicker(input, { excludedId: () => "subway", currentId: () => "panda", onPick: (id) => picked.push(id) });
  // Each row's parts (badge, name, "Current") joined with spaces, as a person reads them.
  const rows = () => [...document.querySelectorAll<HTMLElement>(".picker li")].map((li) => [...li.children].map((part) => part.textContent).join(" "));
  return { input, picked, rows };
}

describe("saved-option picker", () => {
  beforeEach(() => {
    state.choices = [
      { id: "papajohns", name: "Papa John's", color: "#E5173F", ovr: 70, logo: null },
      { id: "subway", name: "Subway", color: "#0FA958", ovr: 70, logo: null },
      { id: "panda", name: "Panda Express", color: "#FF4D2E", ovr: 70, logo: null },
      { id: "chipotle", name: "Chipotle", color: "#B4521D", ovr: 70, logo: null },
    ];
  });

  // Regression: the old browser suggestion list only showed names matching the box, so a filled-in
  // box offered nothing to switch to.
  it("lists every saved option except the other side's when the box is tapped", () => {
    const { input, rows } = setUp();
    input.dispatchEvent(new Event("focus"));
    expect(rows()).toEqual(["PJ Papa John's", "PE Panda Express Current", "CH Chipotle"]);
  });

  it("swaps in the option that's tapped", () => {
    const { input, picked } = setUp();
    input.dispatchEvent(new Event("focus"));
    [...document.querySelectorAll<HTMLElement>(".picker li")].find((li) => li.textContent?.includes("Chipotle"))!.click();
    expect(picked).toEqual(["chipotle"]);
  });

  it("filters while typing and offers to add a name that isn't saved", () => {
    const { input, picked, rows } = setUp();
    input.dispatchEvent(new Event("focus"));
    input.value = "Taco Bell";
    input.dispatchEvent(new Event("input"));
    expect(rows()).toEqual(["+ Add “Taco Bell”"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(state.choices.some((c) => c.name === "Taco Bell")).toBe(true);
    expect(picked).toHaveLength(1);
  });
});
