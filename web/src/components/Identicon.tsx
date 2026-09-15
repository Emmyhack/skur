import { useMemo } from "react";
import { keccak256, stringToHex } from "viem";

/** Deterministic blocky identicon for an address, in the spirit of the avatar Safe shows beside every account. */
export function Identicon({ address, size = 40 }: { address: string; size?: number }) {
  const { cells, fg, bg } = useMemo(() => {
    const hash = keccak256(stringToHex(address.toLowerCase())).slice(2);
    const hue = parseInt(hash.slice(0, 4), 16) % 360;
    const hue2 = (hue + 140) % 360;
    const bits = hash.slice(4);
    const cells: boolean[] = [];
    // 5x5 grid, mirrored horizontally; 15 bits drive the left half + centre column
    for (let y = 0; y < 5; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < 3; x++) {
        const nibble = parseInt(bits[(y * 3 + x) % bits.length], 16);
        row.push(nibble % 3 !== 0);
      }
      cells.push(row[0], row[1], row[2], row[1], row[0]);
    }
    return { cells, fg: `hsl(${hue} 70% 45%)`, bg: `hsl(${hue2} 60% 88%)` };
  }, [address]);
  const unit = size / 5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: "50%", flex: "none" }} aria-hidden>
      <rect width={size} height={size} fill={bg} />
      {cells.map((on, i) =>
        on ? <rect key={i} x={(i % 5) * unit} y={Math.floor(i / 5) * unit} width={unit + 0.5} height={unit + 0.5} fill={fg} /> : null,
      )}
    </svg>
  );
}
