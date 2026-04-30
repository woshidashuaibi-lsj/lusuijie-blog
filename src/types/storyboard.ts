export type PoseType = 'stand' | 'sit' | 'run' | 'fight' | 'fall';
export type SceneType = 'outdoor' | 'indoor' | 'abstract';

export interface StoryboardFigure {
  name: string;
  pose: PoseType;
  positionX: 'left' | 'center' | 'right';
  dialogue?: string;
}

export interface StoryboardPanel {
  index: number;
  sceneType: SceneType;
  narration?: string;
  /** MiniMax image-01 图片生成描述词（英文），由 storyboard API 生成 */
  imagePrompt?: string;
  /** MiniMax image-01 生成的图片 base64（由服务端并发生成后随 panels 一起返回） */
  imageBase64?: string;
  figures: StoryboardFigure[];
}

export interface StoryboardScene {
  chapterId: string;
  panels: StoryboardPanel[];
  generatedAt: number;
}
