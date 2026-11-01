import AuthPage, { authTitle } from "@/components/candidate/auth-page";

export const generateMetadata = () => authTitle("forgot");
export default function Page() { return <AuthPage mode="forgot" />; }
