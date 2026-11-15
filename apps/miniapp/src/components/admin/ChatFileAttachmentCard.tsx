import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Check } from 'lucide-react';
import type { AdminAiFileAttachment } from '../../api/admin-types';
import { downloadAdminAiExportFile } from '../../api/admin-api';

export function ChatFileAttachmentCard({ attachment }: { attachment: AdminAiFileAttachment }) {
  const [downloaded, setDownloaded] = useState(false);
  const isExcel = attachment.format === 'EXCEL';

  const handleDownload = () => {
    void downloadAdminAiExportFile(attachment.downloadUrl, attachment.filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--pure-white)] p-3 shadow-2xs transition-all hover:border-[var(--electric-cobalt)]/40 hover:shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        {/* File Type Icon Banner */}
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${
            isExcel
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
              : 'border-blue-500/30 bg-blue-500/10 text-blue-600'
          }`}
        >
          {isExcel ? <FileSpreadsheet className="size-5" /> : <FileText className="size-5" />}
        </div>

        {/* File Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-[var(--ink-charcoal)] truncate">
              {attachment.title || attachment.filename}
            </h4>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${
                isExcel
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-700'
              }`}
            >
              {attachment.format}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[var(--slate-gray)] mt-0.5">
            <span className="font-mono text-[var(--steel-gray)] truncate">
              {attachment.filename}
            </span>
            {attachment.recordCount !== undefined ? (
              <>
                <span>•</span>
                <span>{attachment.recordCount} rows</span>
              </>
            ) : null}
            {attachment.fileSizeBytes ? (
              <>
                <span>•</span>
                <span>{formatFileSize(attachment.fileSizeBytes)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Download Action Button */}
      <button
        type="button"
        onClick={handleDownload}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs ${
          downloaded
            ? 'bg-emerald-600 text-white'
            : isExcel
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-[var(--electric-cobalt)] text-white hover:opacity-90'
        }`}
      >
        {downloaded ? (
          <>
            <Check className="size-3.5" />
            <span>Saved</span>
          </>
        ) : (
          <>
            <Download className="size-3.5" />
            <span>Download</span>
          </>
        )}
      </button>
    </div>
  );
}
