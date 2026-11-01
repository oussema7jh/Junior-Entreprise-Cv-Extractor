import AuthPage, { authTitle } from "@/components/candidate/auth-page";

export const generateMetadata = () => authTitle("login");
export default function Page() { return <AuthPage mode="login" />; }
