export type Role = "candidate" | "company" | "admin";
export const homeFor: Record<Role, string> = { candidate: "/candidate", company: "/company/cvs", admin: "/admin" };
export const loginFor: Record<Role, string> = { candidate: "/candidate/login", company: "/company/login", admin: "/admin/login" };
export function asRole(value: unknown): Role | null {
  return value === "candidate" || value === "company" || value === "admin" ? value : null;
}
const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
export function requiredRole(path: string): Role | null {
  if (["/candidate/login", "/candidate/signup", "/candidate/forgot-password", "/candidate/reset-password", "/company/login", "/admin/login", "/api/candidate/auth", "/api/company/auth", "/api/admin/auth"].includes(path)) return null;
  if (within(path, "/admin") || within(path, "/api/admin")) return "admin";
  if (within(path, "/company") || within(path, "/api/company") || within(path, "/p")) return "company";
  if (within(path, "/candidate") || within(path, "/api/candidate") || within(path, "/api/cv") || within(path, "/api/profile")) return "candidate";
  return null;
}
export function pageRedirect(path: string, role: Role | null): string | null {
  const required = requiredRole(path);
  if (required && role !== required) return role ? homeFor[role] : loginFor[required];
  if (role && Object.values(loginFor).includes(path)) return homeFor[role];
  return null;
}
