import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

function equal(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorized(request, mode) {
  const expected = mode === "cron" ? env.CRON_SECRET : env.ADMIN_TOKEN;
  if (!expected) return false;
  if (mode === "cron") {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    return equal(token, expected);
  }
  return equal(request.headers["x-admin-token"] || null, expected);
}
