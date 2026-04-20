/**
 * 书中人物相关类型定义
 * 用于人物图鉴、角色扮演对话等功能
 */

/** 人物与其他角色的关系描述 */
export interface CharacterRelation {
  /** 关联人物 ID */
  characterId: string;
  /** 关系描述，如「师徒关系，丹阳子是李火旺的师傅」 */
  description: string;
}

/** 书中人物完整数据 */
export interface Character {
  /** 唯一标识，如 "li-huowang" */
  id: string;
  /** 姓名，如 "李火旺" */
  name: string;
  /** 头像 emoji，如 "🔥" */
  avatar: string;
  /** 身份/职位标签，如 "精神病患者 / 修仙者" */
  role: string;
  /** 性格特征数组，每条一句话 */
  traits: string[];
  /** 说话风格描述 */
  speechStyle: string;
  /** 完整角色扮演提示词，用于 AI system prompt */
  persona: string;
  /** 与其他人物的关系列表 */
  relations: CharacterRelation[];
}

/** 人物数据文件的根结构 */
export interface CharactersData {
  characters: Character[];
}

/** 对话模式枚举 */
export type ChatMode = 'reader' | 'player';
