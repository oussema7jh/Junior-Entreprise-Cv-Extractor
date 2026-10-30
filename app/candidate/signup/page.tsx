import AuthPage from "@/components/candidate/auth-page";
import en from "@/messages/en.json";
export const metadata = { title: en.candidateAuth.pages.signup.title };
export default function Page() { return <AuthPage mode="signup" />; }
