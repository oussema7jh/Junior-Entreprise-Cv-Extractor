import UploadForm from "@/components/candidate/upload-form";
import en from "@/messages/en.json";

export const metadata = { title: en.upload.pageTitle };

export default function UploadPage() {
  return <UploadForm />;
}
