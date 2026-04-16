export type ThemeKey = 'forest' | 'spectrum' | 'ink' | 'warm';

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  description: string;
  psychologyNote: string;
  tokens: {
    colorPrimary: string;
    colorBgContainer: string;
    colorBgLayout: string;
    colorText: string;
    colorTextSecondary: string;
    colorBorder: string;
    colorSuccess: string;
    colorWarning: string;
    colorError: string;
    colorInfo: string;
    borderRadius: number;
    fontFamily: string;
  };
  loginBg: string;
}

export const themes: Record<ThemeKey, ThemeDefinition> = {
  forest: {
    key: 'forest',
    label: '森林疗愈',
    description: '自然绿意，平静安全感',
    psychologyNote: '生态心理学(Biophilia) — 自然元素降低焦虑、增加安全感',
    tokens: {
      colorPrimary: '#2D6A4F',
      colorBgContainer: '#F5F0E8',
      colorBgLayout: '#E8E0D0',
      colorText: '#1B4332',
      colorTextSecondary: '#52796F',
      colorBorder: '#B7D1C3',
      colorSuccess: '#40916C',
      colorWarning: '#D4A373',
      colorError: '#BC4749',
      colorInfo: '#52796F',
      borderRadius: 8,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg:
      'linear-gradient(135deg, #2D6A4F 0%, #40916C 40%, #74C69D 100%)',
  },
  spectrum: {
    key: 'spectrum',
    label: '情绪光谱',
    description: '柔和渐变，情绪连续体',
    psychologyNote:
      'Plutchik情绪轮 — 色彩编码映射心理状态，蓝色=平静/信任',
    tokens: {
      colorPrimary: '#4A6FA5',
      colorBgContainer: '#F0F4F8',
      colorBgLayout: '#E2E8F0',
      colorText: '#2D3748',
      colorTextSecondary: '#718096',
      colorBorder: '#CBD5E0',
      colorSuccess: '#48BB78',
      colorWarning: '#ED8936',
      colorError: '#E53E3E',
      colorInfo: '#4299E1',
      borderRadius: 6,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg:
      'linear-gradient(135deg, #667EEA 0%, #764BA2 50%, #F093FB 100%)',
  },
  ink: {
    key: 'ink',
    label: '水墨留白',
    description: '东方美学，正念空间',
    psychologyNote:
      '正念(Mindfulness) — 留白=心理空间，减少信息过载',
    tokens: {
      colorPrimary: '#4A5568',
      colorBgContainer: '#FAFAF5',
      colorBgLayout: '#F5F0E8',
      colorText: '#1A202C',
      colorTextSecondary: '#718096',
      colorBorder: '#D0D0C8',
      colorSuccess: '#68D391',
      colorWarning: '#F6AD55',
      colorError: '#C75050',
      colorInfo: '#90A4AE',
      borderRadius: 4,
      fontFamily:
        "'Noto Serif SC', 'STSong', 'PingFang SC', serif",
    },
    loginBg:
      'linear-gradient(135deg, #2C2C2C 0%, #4A5568 50%, #90A4AE 100%)',
  },
  warm: {
    key: 'warm',
    label: '温暖几何',
    description: '亲和温暖，安全感',
    psychologyNote:
      '环境心理学 — 圆角=安全感，暖色调=亲和/信任',
    tokens: {
      colorPrimary: '#C97B3D',
      colorBgContainer: '#FFF8F0',
      colorBgLayout: '#FEEBC8',
      colorText: '#3D2E1C',
      colorTextSecondary: '#8B7355',
      colorBorder: '#E8D5B8',
      colorSuccess: '#6EE7B7',
      colorWarning: '#FBBF24',
      colorError: '#EF4444',
      colorInfo: '#6DB8C4',
      borderRadius: 12,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg:
      'linear-gradient(135deg, #FBBF24 0%, #F59E0B 30%, #D97706 70%, #C97B3D 100%)',
  },
};

export const themeKeys = Object.keys(themes) as ThemeKey[];
