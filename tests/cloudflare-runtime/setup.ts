import { afterAll, afterEach, beforeAll } from "vitest";
import { network } from "./network";

beforeAll(() => network.enable({ onUnhandledRequest: "error" }));
afterEach(() => network.resetHandlers());
afterAll(() => network.disable());
