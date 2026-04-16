import { useRef, useState } from 'react';
import { ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { Button, Tag, Modal, Descriptions, Spin, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import request from '../../utils/request';

export default function ScaleLibrary() {
  const actionRef = useRef<ActionType>();
  const [cloning, setCloning] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const basePath = location.pathname.startsWith('/admin') ? '/admin' : '/teacher';

  const handleClone = async (id: string) => {
    setCloning(id);
    try {
      const res: any = await request.post(`/scales/library/${id}/clone`);
      message.success('选用成功');
      navigate(`${basePath}/scales/${res.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || '选用失败';
      message.error(msg);
    } finally {
      setCloning(null);
    }
  };

  const handlePreview = async (id: string) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res: any = await request.get(`/scales/${id}`);
      setPreview(res);
    } catch {
      message.error('加载预览失败');
    } finally {
      setPreviewLoading(false);
    }
  };

  const columns: ProColumns[] = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '题目数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: any) => record.items?.length ?? '-',
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: any) => (
        <>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.id)}
          >
            预览
          </Button>
          <Button
            type="link"
            loading={cloning === record.id}
            onClick={() => handleClone(record.id)}
          >
            选用
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        headerTitle="量表库"
        request={async () => {
          const res: any = await request.get('/scales/library');
          const data = Array.isArray(res) ? res : res.data || [];
          return { data, total: data.length, success: true };
        }}
        search={false}
        toolBarRender={false}
      />

      <Modal
        title={preview ? `预览：${preview.name}` : '预览'}
        open={!!preview || previewLoading}
        onCancel={() => setPreview(null)}
        footer={null}
        width={720}
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : preview ? (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="版本">{preview.version}</Descriptions.Item>
              <Descriptions.Item label="题目数">{preview.items?.length ?? 0}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{preview.description || '-'}</Descriptions.Item>
            </Descriptions>

            <h4 style={{ margin: '16px 0 8px' }}>题目列表</h4>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {(preview.items || []).map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    background: '#fafafa',
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>
                    {idx + 1}. {item.itemText}
                    {item.dimension && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>{item.dimension}</Tag>
                    )}
                    {item.reverseScore && (
                      <Tag color="orange" style={{ marginLeft: 4 }}>反向题</Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(item.options || []).map((opt: any, oi: number) => (
                      <Tag key={oi}>
                        {opt.optionText}（{opt.scoreValue}分）
                      </Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {preview.scoreRanges?.length > 0 && (
              <>
                <h4 style={{ margin: '16px 0 8px' }}>分数区间</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {preview.scoreRanges.map((sr: any, si: number) => (
                    <Tag
                      key={si}
                      color={sr.color === 'green' ? 'success' : sr.color === 'yellow' ? 'warning' : sr.color === 'red' ? 'error' : 'default'}
                    >
                      {sr.minScore}–{sr.maxScore} {sr.level}：{sr.suggestion}
                    </Tag>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
