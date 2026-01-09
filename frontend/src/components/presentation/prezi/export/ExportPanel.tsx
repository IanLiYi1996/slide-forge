/**
 * ExportPanel Component
 *
 * Unified export panel with tabs for different export formats:
 * - PDF (snapshots)
 * - Interactive HTML
 * - Video/GIF
 */

"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, FileCode, Video } from "lucide-react";
import PDFExporter from "./PDFExporter";
import HTMLExporter from "./HTMLExporter";
import VideoExporter from "./VideoExporter";

interface ExportPanelProps {
  presentationTitle?: string;
}

/**
 * ExportPanel component
 */
const ExportPanel: React.FC<ExportPanelProps> = ({
  presentationTitle = "Prezi Presentation",
}) => {
  const [activeTab, setActiveTab] = useState("pdf");

  return (
    <Card className="w-full h-full border-0 bg-transparent shadow-none flex flex-col">
      <CardHeader className="px-0 flex-shrink-0">
        <CardTitle className="text-sm">Export Presentation</CardTitle>
        <p className="text-xs opacity-60">
          Choose your preferred export format
        </p>
      </CardHeader>
      <CardContent className="px-0 flex-1 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pdf" className="text-xs">
              <FileDown className="mr-1 h-3 w-3" />
              PDF
            </TabsTrigger>
            <TabsTrigger value="html" className="text-xs">
              <FileCode className="mr-1 h-3 w-3" />
              HTML
            </TabsTrigger>
            <TabsTrigger value="video" className="text-xs">
              <Video className="mr-1 h-3 w-3" />
              Video
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="pdf" className="mt-0">
              <PDFExporter presentationTitle={presentationTitle} />
            </TabsContent>

            <TabsContent value="html" className="mt-0">
              <HTMLExporter presentationTitle={presentationTitle} />
            </TabsContent>

            <TabsContent value="video" className="mt-0">
              <VideoExporter presentationTitle={presentationTitle} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ExportPanel;
