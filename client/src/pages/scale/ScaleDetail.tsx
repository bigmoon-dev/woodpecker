import { useEffect, useState } from 'react';
import { Card, Button, Input, Spin, Form, Space, Divider, Popconfirm, message, Select, Switch, InputNumber } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

interface ScaleItem {
  id?: string;
  itemText: string;
  itemType: string;
  sortOrder: number;
  dimension?: string;
  reverseScore: boolean;
  options: { optionText: string; scoreValue: number; sortOrder: number }[];
}

interface ScaleData {
  id: string;
  name: string;
  version: string;
  description: string;
  items: ScaleItem[];
}

const ITEM_TYPES = [
  { label: '单选', value: 'single_choice' },
  { label: '多选', value: 'multi_choice' },
  { label: '填空', value: 'text' },
];

export default function ScaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ScaleItem[]>([]);

  useEffect(() => {
    if (!id) return;
    request.get(`/scales/${id}`)
      .then((res: any) => {
        setName(res.name || '');
        setVersion(res.version || '1.0');
        setDescription(res.description || '');
        setItems(
          (res.items || []).map((item: any) => ({
            id: item.id,
            itemText: item.itemText || item.content || '',
            itemType: item.itemType || 'single_choice',
            sortOrder: item.sortOrder ?? 0,
            dimension: item.dimension || '',
            reverseScore: item.reverseScore || false,
            options: (item.options || []).map((opt: any) => ({
              optionText: opt.optionText || opt.content || '',
              scoreValue: opt.scoreValue ?? opt.score ?? 0,
              sortOrder: opt.sortOrder ?? 0,
            })),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) return message.warning('请填写量表名称');
    setSaving(true);
    try {
      const dto = {
        name,
        version,
        description,
        items: items.map((item, idx) => ({
          itemText: item.itemText,
          itemType: item.itemType,
          sortOrder: idx,
          dimension: item.dimension || undefined,
          reverseScore: item.reverseScore,
          options: item.options.map((opt, oi) => ({
            optionText: opt.optionText,
            scoreValue: opt.scoreValue,
            sortOrder: oi,
          })),
        })),
      };
      await request.put(`/scales/${id}`, dto);
      message.success('保存成功');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { itemText: '', itemType: 'single_choice', sortOrder: prev.length, reverseScore: false, options: [] }]);
  };

  const updateOption = (itemIdx: number, optIdx: number, field: string, value: any) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        const newOpts = item.options.map((opt, oi) => (oi === optIdx ? { ...opt, [field]: value } : opt));
        return { ...item, options: newOpts };
      }),
    );
  };

  const addOption = (itemIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        return { ...item, options: [...item.options, { optionText: '', scoreValue: 0, sortOrder: item.options.length }] };
      }),
    );
  };

  const removeOption = (itemIdx: number, optIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIdx) return item;
        return { ...item, options: item.options.filter((_, oi) => oi !== optIdx) };
      }),
    );
  };

  if (loading) return <Spin />;
  if (!id) return <Card>未找到量表</Card>;

  return (
    <div style={{ maxWidth: 900 }}>
      <Card
        title="编辑量表"
        extra={
          <Space>
            <Button onClick={() => navigate(`${basePath}/scales`)}>返回</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        <Form layout="vertical">
          <Form.Item label="量表名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入量表名称" />
          </Form.Item>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item label="版本">
              <Input value={version} onChange={(e) => setVersion(e.target.value)} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item label="描述">
              <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: 500 }} placeholder="量表描述" />
            </Form.Item>
          </Space>
        </Form>

        <Divider>题目列表（{items.length} 题）</Divider>

        {items.map((item, idx) => (
          <Card
            key={idx}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <span>第 {idx + 1} 题</span>
                <Select value={item.itemType} onChange={(v) => updateItem(idx, 'itemType', v)} options={ITEM_TYPES} style={{ width: 100 }} size="small" />
                {item.itemType !== 'text' && (
                  <label style={{ fontSize: 13 }}>
                    <Switch size="small" checked={item.reverseScore} onChange={(v) => updateItem(idx, 'reverseScore', v)} /> 反向计分
                  </label>
                )}
              </Space>
            }
            extra={
              <Popconfirm title="确定删除此题？" onConfirm={() => removeItem(idx)}>
                <Button type="text" danger size="small" icon={<MinusCircleOutlined />} />
              </Popconfirm>
            }
          >
            <Input.TextArea
              value={item.itemText}
              onChange={(e) => updateItem(idx, 'itemText', e.target.value)}
              placeholder="题目内容"
              autoSize={{ minRows: 1 }}
              style={{ marginBottom: 8 }}
            />
            <Input
              value={item.dimension}
              onChange={(e) => updateItem(idx, 'dimension', e.target.value)}
              placeholder="维度（可选）"
              style={{ width: 200, marginBottom: 8 }}
            />
            {item.itemType !== 'text' && (
              <>
                {item.options.map((opt, oi) => (
                  <Space key={oi} style={{ display: 'flex', marginBottom: 4, paddingLeft: 16 }}>
                    <Input value={opt.optionText} onChange={(e) => updateOption(idx, oi, 'optionText', e.target.value)} placeholder="选项文本" style={{ width: 200 }} />
                    <InputNumber value={opt.scoreValue} onChange={(v) => updateOption(idx, oi, 'scoreValue', v ?? 0)} min={0} placeholder="分值" style={{ width: 80 }} />
                    <Button type="text" danger size="small" icon={<MinusCircleOutlined />} onClick={() => removeOption(idx, oi)} />
                  </Space>
                ))}
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addOption(idx)} style={{ marginLeft: 16 }}>
                  添加选项
                </Button>
              </>
            )}
          </Card>
        ))}

        <Button type="dashed" block icon={<PlusOutlined />} onClick={addItem} style={{ marginTop: 8 }}>
          添加题目
        </Button>
      </Card>
    </div>
  );
}
