import { useEffect, useState } from 'react';
import { Card, Descriptions, Spin } from 'antd';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';

export default function ScaleDetail() {
  const { id } = useParams();
  const [scale, setScale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    request.get(`/scales/${id}`)
      .then((res: any) => setScale(res))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin />;
  if (!scale) return <Card>未找到量表</Card>;

  return (
    <Card title={scale.name}>
      <Descriptions column={1}>
        <Descriptions.Item label="版本">{scale.version}</Descriptions.Item>
        <Descriptions.Item label="描述">{scale.description}</Descriptions.Item>
      </Descriptions>
      {scale.items?.length > 0 && (
        <Card type="inner" title="题目列表" style={{ marginTop: 16 }}>
          {scale.items.map((item: any, idx: number) => (
            <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
              <div>{idx + 1}. {item.content}</div>
              {item.options?.map((opt: any) => (
                <div key={opt.id} style={{ paddingLeft: 16 }}>— {opt.content} ({opt.score}分)</div>
              ))}
            </Card>
          ))}
        </Card>
      )}
    </Card>
  );
}
