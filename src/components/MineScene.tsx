import MineSceneCanvas from './MineSceneCanvas';
import MineViewport, { type MineSceneProps } from './MineViewport';

export default function MineScene(props: MineSceneProps) {
  return <MineViewport {...props} renderCanvas={(canvasProps) => <MineSceneCanvas {...canvasProps} />} />;
}
