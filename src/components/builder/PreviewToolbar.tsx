import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Printer, FileText, FileType, Share2, Loader2, Maximize2, Download, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { compressToEncodedURIComponent } from "lz-string";
import type { ResumeData } from "./types";

type Props = {
  zoom: number;
  setZoom: (z: number) => void;
  data: ResumeData;
  onPdf: () => void;
  onDocx: () => void;
  docxBusy?: boolean;
  extras?: React.ReactNode;
};

export function PreviewToolbar({ zoom, setZoom, data, onPdf, onDocx, docxBusy, extras }: Props) {
  const share = async () => {
    try {
      const payload = compressToEncodedURIComponent(JSON.stringify(data));
      const url = `${window.location.origin}/builder#r=${payload}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not generate share link");
    }
  };
  const clamp = (v: number) => Math.max(0.4, Math.min(1.5, v));
  return (
    <div className="no-print flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/80 backdrop-blur p-1.5 sticky top-16 z-10 mb-3 shadow-[var(--shadow-soft)]">
      <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-background">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom(clamp(zoom - 0.1))} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="px-1.5 text-xs tabular-nums text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom(clamp(zoom + 0.1))} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setZoom(1)} title="Reset zoom">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
      {extras && <div className="flex items-center gap-1.5">{extras}</div>}
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" variant="outline" onClick={share} title="Copy shareable link">
          <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()} title="Print">
          <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Print</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" title="Download resume" style={{ background: "var(--gradient-hero)", color: "white" }}>
              {docxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">Download</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onPdf}>
              <FileText className="h-4 w-4" /> PDF document (.pdf)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDocx} disabled={docxBusy}>
              {docxBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
              Word document (.docx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}