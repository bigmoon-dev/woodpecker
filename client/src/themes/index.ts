export type ThemeKey = 'forest' | 'spectrum' | 'ink' | 'warm';

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  description: string;
  psychologyNote: string;
  tokens: {
    colorPrimary: string;
    colorPrimaryHover: string;
    colorPrimaryActive: string;
    colorBgContainer: string;
    colorBgLayout: string;
    colorText: string;
    colorTextSecondary: string;
    colorBorder: string;
    colorBorderSecondary: string;
    colorSuccess: string;
    colorWarning: string;
    colorError: string;
    colorInfo: string;
    borderRadius: number;
    fontFamily: string;
  };
  loginBg: string;
  siderBg: string;
  gradientPrimary: string;
}

export const themes: Record<ThemeKey, ThemeDefinition> = {
  forest: {
    key: 'forest',
    label: '森林疗愈',
    description: '自然绿意，平静安全感',
    psychologyNote: '生态心理学(Biophilia) — 自然元素降低焦虑、增加安全感',
    tokens: {
      colorPrimary: '#3A7D5C',
      colorPrimaryHover: '#2D6A4F',
      colorPrimaryActive: '#245740',
      colorBgContainer: '#F7F4EE',
      colorBgLayout: '#EDE8DF',
      colorText: '#1B4332',
      colorTextSecondary: '#52796F',
      colorBorder: '#C8D9CE',
      colorBorderSecondary: '#DDE6DF',
      colorSuccess: '#40916C',
      colorWarning: '#D4A373',
      colorError: '#BC4749',
      colorInfo: '#52796F',
      borderRadius: 8,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg: 'linear-gradient(135deg, #2D6A4F 0%, #5BA88C 100%)',
    siderBg: 'linear-gradient(180deg, #2D6A4F 0%, #245740 100%)',
    gradientPrimary: 'linear-gradient(135deg, #3A7D5C 0%, #5BA88C 100%)',
  },
  spectrum: {
    key: 'spectrum',
    label: '情绪光谱',
    description: '柔和渐变，情绪连续体',
    psychologyNote:
      'Plutchik情绪轮 — 色彩编码映射心理状态，蓝色=平静/信任',
    tokens: {
      colorPrimary: '#5B7FBF',
      colorPrimaryHover: '#4A6FA5',
      colorPrimaryActive: '#3D5F91',
      colorBgContainer: '#F2F5FA',
      colorBgLayout: '#E4EAF3',
      colorText: '#2D3748',
      colorTextSecondary: '#718096',
      colorBorder: '#C5D0DC',
      colorBorderSecondary: '#DAE1E9',
      colorSuccess: '#48BB78',
      colorWarning: '#ED8936',
      colorError: '#E53E3E',
      colorInfo: '#4299E1',
      borderRadius: 6,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg: 'linear-gradient(135deg, #5B7FBF 0%, #8B6AAF 100%)',
    siderBg: 'linear-gradient(180deg, #4A6FA5 0%, #3D5F91 100%)',
    gradientPrimary: 'linear-gradient(135deg, #5B7FBF 0%, #8B6AAF 100%)',
  },
  ink: {
    key: 'ink',
    label: '水墨留白',
    description: '东方美学，正念空间',
    psychologyNote:
      '正念(Mindfulness) — 留白=心理空间，减少信息过载',
    tokens: {
      colorPrimary: '#5A6577',
      colorPrimaryHover: '#4A5568',
      colorPrimaryActive: '#3D4654',
      colorBgContainer: '#FAFAF8',
      colorBgLayout: '#F2F0EB',
      colorText: '#1A202C',
      colorTextSecondary: '#718096',
      colorBorder: '#D4D4CC',
      colorBorderSecondary: '#E2E2DB',
      colorSuccess: '#68D391',
      colorWarning: '#F6AD55',
      colorError: '#C75050',
      colorInfo: '#90A4AE',
      borderRadius: 4,
      fontFamily:
        "'Noto Serif SC', 'STSong', 'PingFang SC', serif",
    },
    loginBg: 'linear-gradient(135deg, #5A6577 0%, #8899AA 100%)',
    siderBg: 'linear-gradient(180deg, #4A5568 0%, #3D4654 100%)',
    gradientPrimary: 'linear-gradient(135deg, #5A6577 0%, #8899AA 100%)',
  },
  warm: {
    key: 'warm',
    label: '温暖几何',
    description: '亲和温暖，安全感',
    psychologyNote:
      '环境心理学 — 圆角=安全感，暖色调=亲和/信任',
    tokens: {
      colorPrimary: '#D4915C',
      colorPrimaryHover: '#C97B3D',
      colorPrimaryActive: '#B56E33',
      colorBgContainer: '#FFFAF5',
      colorBgLayout: '#FDF3E7',
      colorText: '#3D2E1C',
      colorTextSecondary: '#8B7355',
      colorBorder: '#E5D5C0',
      colorBorderSecondary: '#EDE3D4',
      colorSuccess: '#6EE7B7',
      colorWarning: '#FBBF24',
      colorError: '#EF4444',
      colorInfo: '#6DB8C4',
      borderRadius: 12,
      fontFamily:
        "'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
    },
    loginBg: 'linear-gradient(135deg, #D4915C 0%, #E8B88A 100%)',
    siderBg: 'linear-gradient(180deg, #C97B3D 0%, #B56E33 100%)',
    gradientPrimary: 'linear-gradient(135deg, #D4915C 0%, #E8B88A 100%)',
  },
};

export const themeKeys = Object.keys(themes) as ThemeKey[];
