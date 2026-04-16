import { Dropdown } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { useTheme } from '../themes/ThemeProvider';
import { themeKeys, themes } from '../themes';

export default function ThemePicker() {
  const { themeKey, setThemeKey } = useTheme();

  const items = themeKeys.map((key) => ({
    key,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: themes[key].tokens.colorPrimary,
            display: 'inline-block',
            border:
              key === themeKey ? '2px solid #000' : '1px solid #d9d9d9',
          }}
        />
        <span>{themes[key].label}</span>
        <span style={{ color: '#999', fontSize: 12 }}>
          {themes[key].description}
        </span>
      </div>
    ),
    onClick: () => setThemeKey(key),
  }));

  return (
    <Dropdown menu={{ items, selectedKeys: [themeKey] }} trigger={['click']}>
      <BgColorsOutlined
        style={{ fontSize: 18, cursor: 'pointer' }}
        title="切换主题"
      />
    </Dropdown>
  );
}
