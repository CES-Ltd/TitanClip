/**
 * ThinkingIndicator — playful, whimsical "thinking" UI with morphing animation.
 *
 * Displays funny random words (from tengu_spinner_words) with a
 * Claude-style morphing blob animation while the agent processes requests.
 */

import { useState, useEffect, useRef } from "react";

const THINKING_WORDS = [
  "Accomplishing", "Actioning", "Actualizing", "Baking", "Booping",
  "Brewing", "Calculating", "Cerebrating", "Channelling", "Churning",
  "Clauding", "Coalescing", "Cogitating", "Combobulating", "Computing",
  "Concocting", "Conjuring", "Considering", "Contemplating", "Cooking",
  "Crafting", "Creating", "Crunching", "Deciphering", "Deliberating",
  "Determining", "Discombobulating", "Divining", "Doing", "Effecting",
  "Elucidating", "Enchanting", "Envisioning", "Finagling", "Flibbertigibbeting",
  "Forging", "Forming", "Frolicking", "Generating", "Germinating",
  "Hatching", "Herding", "Honking", "Hustling", "Ideating",
  "Imagining", "Incubating", "Inferring", "Jiving", "Manifesting",
  "Marinating", "Meandering", "Moseying", "Mulling", "Mustering",
  "Musing", "Noodling", "Percolating", "Perusing", "Philosophising",
  "Pondering", "Pontificating", "Processing", "Puttering", "Puzzling",
  "Reticulating", "Ruminating", "Scheming", "Schlepping", "Shimmying",
  "Shucking", "Simmering", "Smooshing", "Spelunking", "Spinning",
  "Stewing", "Sussing", "Synthesizing", "Thinking", "Tinkering",
  "Transmuting", "Unfurling", "Unravelling", "Vibing", "Wandering",
  "Whirring", "Wibbling", "Wizarding", "Working", "Wrangling",
];

function getRandomWord(exclude?: string): string {
  let word: string;
  do {
    word = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]!;
  } while (word === exclude);
  return word;
}

export function ThinkingIndicator() {
  const [currentWord, setCurrentWord] = useState(() => getRandomWord());
  const [nextWord, setNextWord] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dots, setDots] = useState("");

  // Cycle words every 2.5 seconds with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      const next = getRandomWord(currentWord);
      setNextWord(next);
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentWord(next);
        setNextWord("");
        setIsTransitioning(false);
      }, 400);
    }, 2500);

    return () => clearInterval(interval);
  }, [currentWord]);

  // Animate trailing dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-start gap-3">
      {/* Morphing blob */}
      <div className="relative w-10 h-10 shrink-0">
        <MorphingBlob />
      </div>

      {/* Word display */}
      <div className="flex-1 rounded-2xl bg-card border border-border px-4 py-3 min-w-[180px]">
        <div className="relative h-6 overflow-hidden">
          {/* Current word */}
          <span
            className={`absolute inset-0 flex items-center text-sm font-medium text-indigo-400 transition-all duration-400 ease-out ${
              isTransitioning
                ? "opacity-0 -translate-y-3 blur-[2px]"
                : "opacity-100 translate-y-0 blur-0"
            }`}
          >
            {currentWord}{dots}
          </span>

          {/* Next word (fading in) */}
          {nextWord && (
            <span
              className={`absolute inset-0 flex items-center text-sm font-medium text-indigo-400 transition-all duration-400 ease-out ${
                isTransitioning
                  ? "opacity-100 translate-y-0 blur-0"
                  : "opacity-0 translate-y-3 blur-[2px]"
              }`}
            >
              {nextWord}{dots}
            </span>
          )}
        </div>

        {/* Subtle shimmer bar */}
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-indigo-500/0 via-indigo-500/60 to-indigo-500/0 animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

/**
 * MorphingBlob — Claude-style organic morphing animation.
 * Uses CSS keyframe animations with SVG filter for smooth blob morphing.
 */
function MorphingBlob() {
  return (
    <div className="w-10 h-10 relative">
      {/* SVG filter for gooey effect */}
      <svg className="absolute" width="0" height="0">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      {/* Morphing circles */}
      <div className="absolute inset-0" style={{ filter: "url(#goo)" }}>
        <div
          className="absolute rounded-full bg-indigo-500/80 animate-morph-a"
          style={{ width: "22px", height: "22px", left: "6px", top: "6px" }}
        />
        <div
          className="absolute rounded-full bg-purple-500/70 animate-morph-b"
          style={{ width: "18px", height: "18px", left: "14px", top: "12px" }}
        />
        <div
          className="absolute rounded-full bg-indigo-400/60 animate-morph-c"
          style={{ width: "14px", height: "14px", left: "4px", top: "16px" }}
        />
      </div>

      {/* Inner glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-3 h-3 rounded-full bg-white/20 animate-pulse-glow"
        />
      </div>
    </div>
  );
}
