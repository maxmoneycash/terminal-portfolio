import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { portfolio } from "../data/portfolio";
import { cn } from "../lib/cn";

type PortfolioBookletOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

type BookletPage = {
  eyebrow: string;
  title: string;
  body?: string;
  items?: string[];
  footer?: string;
  dark?: boolean;
};

const pageWidth = 400;
const pageHeight = 600;
const pageTurnMs = 700;
const resetStepMs = 80;

const proofLinks = [
  "aptos-polymarket.vercel.app",
  "whop.finance",
  "github.com/SeamMoney/decibrrr",
  "github.com/SeamMoney/aptos-move-transpiler",
  "github.com/SeamMoney/tx-composer",
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function textBlock(lines: string[], x: number, y: number, lineHeight: number, fill: string, size: number, weight = 450) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function pageSvg(page: BookletPage, side: "front" | "back") {
  const dark = page.dark;
  const bg = dark ? "#101820" : "#e8eef2";
  const ink = dark ? "#eef6f8" : "#101820";
  const muted = dark ? "#96adba" : "#536974";
  const rule = dark ? "#bfdbfe" : "#0e7490";
  const accent = dark ? "#18262d" : "#d4e2e8";
  const bodyLines = page.body ? wrapText(page.body, 36).slice(0, 8) : [];
  const items = (page.items ?? []).slice(0, 6);
  const itemLines = items.flatMap((item) => wrapText(item, 34).slice(0, 2).map((line, index) => ({ line, indent: index > 0 })));
  const titleLines = wrapText(page.title, 15).slice(0, 3);
  const bodyY = 202 + titleLines.length * 44;
  const itemY = bodyY + bodyLines.length * 24 + (bodyLines.length > 0 ? 30 : 0);
  const footerLines = page.footer ? wrapText(page.footer, 35).slice(0, 2) : [];
  const spineX = side === "front" ? 0 : 352;
  const spineGradientId = `spine-${side}-${dark ? "dark" : "light"}`;

  const itemsMarkup = itemLines
    .slice(0, 10)
    .map(({ line, indent }, index) => {
      const y = itemY + index * 25;
      const marker = indent ? "" : `<text x="48" y="${y}" font-size="17" fill="${rule}" font-weight="700">&gt;</text>`;
      return `${marker}<text x="${indent ? 70 : 70}" y="${y}" font-size="17" fill="${ink}" opacity="${indent ? 0.78 : 0.92}">${escapeXml(line)}</text>`;
    })
    .join("");

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}" height="${pageHeight}" viewBox="0 0 ${pageWidth} ${pageHeight}">
  <defs>
    <linearGradient id="${spineGradientId}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="${dark ? "0.34" : "0.16"}"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <filter id="paperNoise">
      <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="${dark ? "9" : "4"}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.055"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="400" height="600" fill="${bg}"/>
  <rect width="400" height="600" fill="${dark ? "#ffffff" : "#111827"}" filter="url(#paperNoise)" opacity="${dark ? "0.12" : "0.08"}"/>
  <rect x="${spineX}" y="0" width="48" height="600" fill="url(#${spineGradientId})" opacity="0.9"/>
  <rect x="34" y="34" width="332" height="532" rx="18" fill="none" stroke="${accent}" stroke-width="1.5"/>
  <rect x="38" y="56" width="54" height="4" fill="${rule}"/>
  <text x="38" y="103" font-size="13" letter-spacing="4" font-weight="700" fill="${muted}">${escapeXml(page.eyebrow.toUpperCase())}</text>
  ${textBlock(titleLines, 38, 160, 44, ink, 38, 760)}
  ${textBlock(bodyLines, 39, bodyY, 24, muted, 18, 430)}
  ${itemsMarkup}
  ${footerLines.length > 0 ? textBlock(footerLines, 38, 536, 22, muted, 15, 500) : ""}
</svg>
`)}`;
}

function buildPages(): BookletPage[] {
  return [
    {
      eyebrow: "portfolio booklet",
      title: "Maxwell Mohammadi",
      body: "Product engineer building Aptos Move systems, LLM agent tooling, and onchain trading products.",
      items: ["Palo Alto / San Francisco Bay Area", "Aptos Labs", "Move, MCP, trading systems"],
      footer: "Click the book to flip.",
      dark: true,
    },
    {
      eyebrow: "profile",
      title: "What Max Builds",
      body: portfolio.summary,
      items: portfolio.focus,
    },
    {
      eyebrow: "current role",
      title: "Aptos Labs",
      body: "Shipping agent-facing protocol infrastructure and pitch-ready product demos with founding engineers and partner teams.",
      items: [
        "LLM MCP servers for Decibel Trade and Shelby Protocol",
        "PineScript indicators into onchain trading bots",
        "Prediction market Move contract benchmarked to 10k TPS",
      ],
    },
    {
      eyebrow: "selected work",
      title: "Projects",
      items: portfolio.projects.slice(0, 4).map((project) => `${project.name}: ${project.stack}`),
      footer: "Run proof or resume projects for links.",
    },
    {
      eyebrow: "proof",
      title: "Live Demos + Repos",
      items: proofLinks,
    },
    {
      eyebrow: "systems",
      title: "How I Work",
      body: "Build the demo, prove the technical path, tighten the contracts and SDK flows, then make partner teams touch the product directly.",
      items: ["Move contracts", "TypeScript SDK flows", "LLM agent tools", "High-throughput benchmarking"],
    },
    {
      eyebrow: "experience",
      title: "Security Background",
      body: "Before Aptos, I audited enterprise crypto custody infrastructure at EY Blockchain and built incident response experience across onchain systems.",
      items: ["Trail of Bits collaboration", "TRM Labs investigations", "EVM, Aptos, Sui, Hyperliquid research"],
    },
    {
      eyebrow: "contact",
      title: "Keep Reading in the Terminal",
      items: [
        portfolio.links.github,
        portfolio.links.linkedin,
        portfolio.links.email.replace("mailto:", ""),
        "Run contact, resume, or open github",
      ],
      footer: "Run booklet hide to close.",
      dark: true,
    },
  ];
}

function pairImages(pages: BookletPage[]) {
  const imagePages = pages.map((page, index) => pageSvg(page, index % 2 === 0 ? "front" : "back"));
  const padded = imagePages.length % 2 === 0 ? imagePages : [...imagePages, imagePages[imagePages.length - 1]];
  const pairs: Array<[string, string]> = [];

  for (let index = 0; index < padded.length; index += 2) {
    pairs.push([padded[index], padded[index + 1]]);
  }

  return pairs;
}

export function PortfolioBookletOverlay({ visible, onClose }: PortfolioBookletOverlayProps) {
  const [flippedCount, setFlippedCount] = useState(0);
  const [isBookClosed, setIsBookClosed] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const timersRef = useRef<number[]>([]);
  const leafPairs = useMemo(() => pairImages(buildPages()), []);
  const totalLeaves = leafPairs.length;

  const clearTimers = () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!visible) {
      clearTimers();
      setFlippedCount(0);
      setIsBookClosed(true);
      setIsBusy(false);
    }
  }, [visible]);

  useEffect(
    () => () => {
      clearTimers();
    },
    [],
  );

  if (!visible) return null;

  const closeBook = () => {
    setIsBusy(true);
    setIsBookClosed(false);

    let delay = 0;
    for (let next = totalLeaves - 1; next >= 0; next -= 1) {
      const timer = window.setTimeout(() => {
        setFlippedCount(next);
      }, delay);
      timersRef.current.push(timer);
      delay += resetStepMs;
    }

    const doneTimer = window.setTimeout(() => {
      setFlippedCount(0);
      setIsBookClosed(true);
      setIsBusy(false);
    }, delay + pageTurnMs);
    timersRef.current.push(doneTimer);
  };

  const handleClick = () => {
    if (isBusy) return;

    if (flippedCount === 0) {
      setIsBookClosed(false);
    }

    if (flippedCount < totalLeaves) {
      setIsBusy(true);
      setFlippedCount((value) => Math.min(totalLeaves, value + 1));
      const timer = window.setTimeout(() => setIsBusy(false), pageTurnMs);
      timersRef.current.push(timer);
      return;
    }

    closeBook();
  };

  return (
    <div className="booklet-orbit">
      <button
        className="portfolio-booklet"
        type="button"
        aria-label="Flip through Maxwell Mohammadi portfolio booklet"
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <span className="booklet-scene">
          <motion.span
            className={cn("booklet-book", !isBookClosed && "is-open", isBookClosed && "is-closed")}
            animate={{ x: isBookClosed ? "0%" : "50%" }}
            transition={{ duration: isBookClosed ? 0.8 : 0.6, ease: "easeInOut" }}
          >
            {leafPairs.map(([frontSrc, backSrc], index) => {
              const isFlipped = index < flippedCount;
              const isFlipping = index === flippedCount - 1;
              const zOffset = isFlipped ? index * 0.4 : (totalLeaves - index) * 0.4;
              const zIndex = isFlipping ? 100 : isFlipped ? index : totalLeaves - index;

              return (
                <motion.span
                  className={cn("booklet-leaf", isFlipped && "is-flipped")}
                  key={frontSrc}
                  initial={{ rotateY: 0 }}
                  animate={{ rotateY: isFlipped ? -180 : 0 }}
                  transition={{ duration: isFlipped ? 0.7 : 0.5, ease: isFlipped ? [0.4, 0, 0.2, 1] : "easeInOut" }}
                  style={{ zIndex, z: zOffset }}
                >
                  <span className="booklet-face booklet-face-front">
                    <img src={frontSrc} alt="" draggable={false} />
                    <span className="booklet-spine-gradient" aria-hidden="true" />
                  </span>
                  <span className="booklet-face booklet-face-back">
                    <img src={backSrc} alt="" draggable={false} />
                    <span className="booklet-spine-gradient is-back" aria-hidden="true" />
                  </span>
                </motion.span>
              );
            })}
          </motion.span>
        </span>
      </button>
    </div>
  );
}
