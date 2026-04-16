import { Popover } from 'antd';
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons';
import { useTheme } from '../themes/ThemeProvider';
import { themeKeys, themes, ThemeKey } from '../themes';

export default function ThemePicker() {
  const { themeKey, setThemeKey } = useTheme();

  const content = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 4 }}>
      {themeKeys.map((key) => {
        const t = themes[key];
        const selected = key === themeKey;
        return (
          <div
            key={key}
            onClick={() => setThemeKey(key)}
            style={{
              width: 140,
              borderRadius: t.tokens.borderRadius,
              border: selected ? `2px solid ${t.tokens.colorPrimary}` : '1px solid #e8e8e8',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{
              height: 32,
              background: t.gradientPrimary,
              position: 'relative',
            }}>
              {selected && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: t.tokens.colorPrimary,
                }}>
                  <CheckOutlined />
                </div>
              )}
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.tokens.colorText }}>
                {t.label}
              </div>
              <div style={{ fontSize: 11, color: t.tokens.colorTextSecondary, marginTop: 2 }}>
                {t.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <BgColorsOutlined
        style={{ fontSize: 18, cursor: 'pointer' }}
        title="切换主题"
      />
    </Popover>
  );
}
