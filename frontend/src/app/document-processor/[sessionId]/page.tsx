import { DocumentProcessorPage } from "@/components/document-processor/DocumentProcessorPage";

// 禁用静态生成，因为此页面使用了浏览器特定的 API
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <DocumentProcessorPage sessionId={sessionId} />;
}
