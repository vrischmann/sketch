/* eslint-disable @typescript-eslint/no-explicit-any */
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...(handlers as any));
