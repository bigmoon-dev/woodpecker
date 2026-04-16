import { useEffect, useState } from 'react';
import { Card, Spin, Radio, Button, message, Space } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../utils/request';

export default function Assessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    request
      .get(`/tasks/${id}`)
      .then((res: any) => setTask(res))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!task?.scale?.items) return;
    const items = task.scale.items
      .map((item: any) => {
        const optionId = answers[item.id];
        if (!optionId) return null;
        return { itemId: item.id, optionId };
      })
      .filter(Boolean);

    if (items.length < task.scale.items.length) {
      return message.warning('请完成所有题目');
    }

    setSubmitting(true);
    try {
      await request.post(`/tasks/${id}/answers/submit`, {
        items,
      });
      message.success('提交成功');
      navigate(-1);
    } catch {
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin />;
  if (!task?.scale) return <Card>任务不存在</Card>;

  return (
    <Card title={task.title}>
      {task.scale.items?.map((item: any, idx: number) => (
        <Card
          key={item.id}
          type="inner"
          style={{ marginBottom: 12 }}
          title={`第${idx + 1}题`}
        >
          <div style={{ marginBottom: 8 }}>{item.itemText}</div>
          <Radio.Group
            onChange={(e) =>
              setAnswers({ ...answers, [item.id]: e.target.value })
            }
            value={answers[item.id]}
          >
            <Space direction="vertical">
              {item.options?.map((opt: any) => (
                <Radio key={opt.id} value={opt.id}>
                  {opt.optionText}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Card>
      ))}
      <Button type="primary" loading={submitting} onClick={handleSubmit}>
        提交答案
      </Button>
    </Card>
  );
}
