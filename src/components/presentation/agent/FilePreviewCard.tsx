"use client";

import { X, Loader2, FileText, FileCode, FileSpreadsheet } from "lucide-react";

interface FilePreviewCardProps {
  file: {
    name: string;
    size: number;
    type: string;
  };
  progress?: string;
  onRemove: () => void;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return FileCode;
    case 'csv':
      return FileSpreadsheet;
    case 'txt':
    case 'md':
    case 'docx':
    case 'pdf':
      return FileText;
    default:
      return FileText;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreviewCard({ file, progress, onRemove }: FilePreviewCardProps) {
  const Icon = getFileIcon(file.name);
  const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const isProcessing = progress === 'parsing';
  const hasError = progress === 'error';

  return (
    <div className={`
      relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden
      border bg-card shadow-sm hover:shadow-md transition-all animate-fade-in
      ${hasError ? 'border-destructive' : 'border-border'}
    `}>
      <div className="w-full h-full p-3 flex flex-col justify-between">
        <div className="flex items-center gap-1">
          <div className="p-1.5 bg-muted rounded">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {ext}
          </span>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-medium truncate" title={file.name}>
            {file.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={onRemove}
        disabled={isProcessing}
        className="absolute top-1 right-1 p-1 bg-background/80 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background shadow-sm"
      >
        <X className="w-3 h-3" />
      </button>

      {/* 上传状态 */}
      {isProcessing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
