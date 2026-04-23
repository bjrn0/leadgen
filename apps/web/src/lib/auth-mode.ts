const authMode = process.env.NEXT_PUBLIC_AUTH_MODE ?? "dev-bypass";

export function isClerkMode() {
  return authMode !== "dev-bypass";
}

export function getClerkPublishableKey() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
}
