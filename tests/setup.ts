import "@testing-library/jest-dom/vitest";

import { testEnvironment } from "@/tests/test-environment";

Object.assign(process.env, testEnvironment);
