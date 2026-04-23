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
  /** Pollinations.AI 图片生成描述词（英文） */
  imagePrompt?: string;
  figures: StoryboardFigure[];
}

export interface StoryboardScene {
  chapterId: string;
  panels: StoryboardPanel[];
  generatedAt: number;
}
