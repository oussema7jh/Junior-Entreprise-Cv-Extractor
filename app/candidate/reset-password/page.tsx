import AuthPage, { authTitle } from "@/components/candidate/auth-page";

export const generateMetadata = () => authTitle("reset");
export default function Page() { return <AuthPage mode="reset" />; }
