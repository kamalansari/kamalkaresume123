import { Button } from "@/components/ui/button";
import { Printer, FileText, FileType, Share2, Loader2, Download, ChevronDown, Maximize2, Columns2, Wand2, Link2, Mail, Twitter, Linkedin, MessageCircle, Facebook, RotateCcw, Minus, Plus, PanelLeft, PanelRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import lzString from "lz-string";
const { compressToEncodedURIComponent } = lzString;
import type { ResumeData } from "./types";
import { SIDEBAR_MIN_IN, SIDEBAR_MAX_IN, SIDEBAR_DEFAULT_IN } from "./sidebarAutoFit";

type Props = {
  data: ResumeData;
  getData?: () => ResumeData;
  onPdf: () => void;
  onDocx: () => void;
  docxBusy?: boolean;
  extras?: React.ReactNode;
  onUpdate?: (patch: Partial<ResumeData>) => void;
};

const SCALE_OPTIONS = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15];
const SIDEBAR_PRESETS: { label: string; value: number; hint: string }[] = [
  { label: "Narrow", value: 2.1, hint: "More room for main content" },
  { label: "Standard", value: SIDEBAR_DEFAULT_IN, hint: "Balanced default" },
  { label: "Wide", value: 2.9, hint: "Fits longer headings" },
  { label: "Extra wide", value: SIDEBAR_MAX_IN, hint: "Max — long names / titles" },
];
const TWO_COL_TEMPLATES = new Set([
  "two-column",
  "sidebar-right",
  "compact-two",
  "fresher",
  "contemporary",
  "iconic",
  "creative",
]);
const SIDEBAR_SIDE_SWAP: Record<string, string> = {
  "two-column": "sidebar-right",
  "sidebar-right": "two-column",
};

export function PreviewToolbar({ data, getData, onPdf, onDocx, docxBusy, extras, onUpdate }: Props) {
  const buildShareUrl = () => {
    const payload = compressToEncodedURIComponent(JSON.stringify(getData?.() ?? data));
    return `${window.location.origin}/builder#r=${payload}`;
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl());
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not generate share link");
    }
  };
  const shareName = data.name ? `${data.name}'s resume` : "my resume";
  const shareVia = (platform: "email" | "twitter" | "linkedin" | "whatsapp" | "facebook") => {
    try {
      const url = buildShareUrl();
      const text = `Check out ${shareName}`;
      const enc = encodeURIComponent;
      let target = "";
      switch (platform) {
        case "email":
          target = `mailto:?subject=${enc(text)}&body=${enc(text + "\n\n" + url)}`;
          break;
        case "twitter":
          target = `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
          break;
        case "linkedin":
          target = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
          break;
        case "whatsapp":
          target = `https://wa.me/?text=${enc(text + " " + url)}`;
          break;
        case "facebook":
          target = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
          break;
      }
      window.open(target, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open share window");
    }
  };
  const nativeShare = async () => {
    try {
      const url = buildShareUrl();
      if (navigator.share) {
        await navigator.share({ title: shareName, text: `Check out ${shareName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard");
      }
    } catch {
      // user cancelled or unsupported
    }
  };

  const scale = data.printScale ?? 1;
  const sidebarWidth = data.sidebarWidth ?? 2.55;
  const autoFit = data.sidebarAutoFit !== false;
  const isTwoCol = TWO_COL_TEMPLATES.has(data.template as string);
  return (
    <div className="no-print flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/80 backdrop-blur p-1.5 sticky top-16 z-10 mb-3 shadow-[var(--shadow-soft)]">
      {extras && <div className="flex items-center gap-1.5">{extras}</div>}
      <div className="ml-auto flex items-center gap-1.5">
        {onUpdate && isTwoCol && (
          <Button
            size="sm"
            variant={autoFit ? "default" : "outline"}
            onClick={() => onUpdate({ sidebarAutoFit: !autoFit })}
            title="Auto-fit: slightly widens the sidebar when a heading would clip"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Auto-fit {autoFit ? "on" : "off"}</span>
          </Button>
        )}
        {onUpdate && isTwoCol && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                title="Sidebar column width — widen to prevent clipped headings"
              >
                <Columns2 className="h-4 w-4" />
                <span className="hidden sm:inline">Sidebar {sidebarWidth.toFixed(2)}in</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {SIDEBAR_WIDTH_OPTIONS.map((w) => (
                <DropdownMenuItem
                  key={w}
                  onClick={() => onUpdate({ sidebarWidth: w })}
                  className={Math.abs(w - sidebarWidth) < 0.01 ? "font-semibold" : ""}
                >
                  {w.toFixed(2)}in {Math.abs(w - 2.55) < 0.01 ? "· default" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {onUpdate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" title="Print / PDF scale — applied only to exports">
                <Maximize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Print {Math.round(scale * 100)}%</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {SCALE_OPTIONS.map(s => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => onUpdate({ printScale: s })}
                  className={s === scale ? "font-semibold" : ""}
                >
                  {Math.round(s * 100)}% {s === 1 ? "· match preview" : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" title="Share resume">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={copyLink}>
              <Link2 className="h-4 w-4" /> Copy link
            </DropdownMenuItem>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <DropdownMenuItem onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> Share via device…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => shareVia("email")}>
              <Mail className="h-4 w-4" /> Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => shareVia("linkedin")}>
              <Linkedin className="h-4 w-4" /> LinkedIn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => shareVia("twitter")}>
              <Twitter className="h-4 w-4" /> X / Twitter
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => shareVia("whatsapp")}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => shareVia("facebook")}>
              <Facebook className="h-4 w-4" /> Facebook
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="outline" onClick={onPdf} title="Print">
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