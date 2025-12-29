import { DocumentProcessorPage } from "@/components/document-processor/DocumentProcessorPage";

export default function Page({ params }: { params: { sessionId: string } }) {
  return <DocumentProcessorPage sessionId={params.sessionId} />;
}
