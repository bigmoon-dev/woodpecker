import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Spin, Button, Empty, Typography } from 'antd';
import request from '../../utils/request';

const { Title } = Typography;

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    request
      .get(`/results/${id}`)
      .then((res: any) => {
        setDetail(res);
      })
      .catch(() => {
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!detail) return <Empty description="未找到结果" />;

  const result = detail.result || detail;
  const ds = result.dimensionScores;

  return (
    <div>
      <Button
        type="link"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        &lt; 返回
      </Button>
      <Title level={4}>测评结果详情</Title>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="学生姓名">
            {detail.studentName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="班级">
            {detail.className || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="量表">
            {detail.scaleName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="任务">
            {detail.taskTitle || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="总分">
            {result.totalScore ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="等级">
            {result.level || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="风险">
            {(() => {
              const colorMap: Record<string, { text: string; color: string }> = {
                red: { text: '红色', color: 'red' },
                yellow: { text: '黄色', color: 'orange' },
                green: { text: '绿色', color: 'green' },
                gray: { text: '灰色', color: 'default' },
              };
              const c = colorMap[result.color] || {
                text: result.color,
                color: 'default',
              };
              return (
                <span
                  style={{
                    color: c.color === 'default' ? undefined : c.color,
                    fontWeight: 'bold',
                  }}
                >
                  {c.text}
                </span>
              );
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="测评时间">
            {result.createdAt ? new Date(result.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="建议" span={2}>
            {result.suggestion || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="维度得分" style={{ marginBottom: 16 }}>
        {ds && typeof ds === 'object' && Object.keys(ds).length > 0 ? (
          <Descriptions column={3} bordered size="small">
            {Object.entries(ds).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {String(value)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <Empty description="该量表无量纲数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </div>
  );
}
