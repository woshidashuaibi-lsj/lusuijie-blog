export interface StoryboardFigure {
  name: string;
  pose: string;
  positionX: 'left' | 'center' | 'right';
  dialogue?: string;
}

export interface StoryboardPanel {
  index: number;
  sceneType: string;
  narration?: string;
  /** MiniMax image-01 图片生成描述词（英文），由 storyboard API 生成 */
  imagePrompt?: string;
  /** MiniMax image-01 生成的图片 base64（旧字段，逐步废弃，优先用 imageUrl） */
  imageBase64?: string;
  /** 上传 Supabase Storage 后的永久公开 URL（或降级 base64 data URL） */
  imageUrl?: string;
  figures: StoryboardFigure[];
}

export interface StoryboardScene {
  chapterId: string;
  panels: StoryboardPanel[];
  generatedAt: number;
}
