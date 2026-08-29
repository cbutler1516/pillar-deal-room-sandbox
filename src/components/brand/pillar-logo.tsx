import Image from "next/image";

export const PILLAR_WORDMARK = {
  src: "/assets/pillar-wordmark-white.jpg",
  width: 1024,
  height: 360,
} as const;

export const PILLAR_MARK = {
  src: "/assets/pillar-mark-white.png",
  width: 910,
  height: 990,
} as const;

export function PillarWordmark({
  height,
  priority = false,
  className = "",
}: {
  height: number;
  priority?: boolean;
  className?: string;
}) {
  const width = Math.round((height * PILLAR_WORDMARK.width) / PILLAR_WORDMARK.height);
  return (
    <Image
      src={PILLAR_WORDMARK.src}
      alt="Pillar Private Lending"
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={`w-auto max-w-none object-contain object-left ${className}`.trim()}
      style={{ height, width: "auto" }}
    />
  );
}

export function PillarMark({
  size,
  decorative = false,
  className = "",
}: {
  size: number;
  decorative?: boolean;
  className?: string;
}) {
  const height = Math.round((size * PILLAR_MARK.height) / PILLAR_MARK.width);
  return (
    <Image
      src={PILLAR_MARK.src}
      alt={decorative ? "" : "Pillar Private Lending"}
      width={size}
      height={height}
      unoptimized
      className={`w-auto max-w-none object-contain ${className}`.trim()}
      style={{ width: size, height: "auto" }}
    />
  );
}
