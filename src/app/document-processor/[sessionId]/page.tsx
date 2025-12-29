import { DocumentProcessorPage } from "@/components/document-processor/DocumentProcessorPage";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <DocumentProcessorPage sessionId={sessionId} />;
}
