import './MinePickaxe.css';

type MinePickaxeProps = {
  x: number;
  y: number;
  index: number;
  scale: number;
  offsetX: number;
};

export default function MinePickaxe({ x, y, index, scale, offsetX }: MinePickaxeProps) {
  return (
    <div
      className="mine-pickaxe-swing"
      data-testid={`miner-pickaxe-${String(index)}`}
      style={{ left: offsetX + (x + 28) * scale, top: (y + 5) * scale, animationDelay: `-${String(index % 3 * 130)}ms` }}
    >
      <div className="mine-pickaxe-handle" />
      <div className="mine-pickaxe-head" />
    </div>
  );
}