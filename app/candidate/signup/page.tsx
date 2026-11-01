import AuthPage, { authTitle } from "@/components/candidate/auth-page";

export const generateMetadata = () => authTitle("signup");
export default function Page() { return <AuthPage mode="signup" />; }
