import { useEffect, useState } from 'react';
import { Upload, Button, List, Tag, message, Popconfirm, Space } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import request from '../../utils/request';

interface FileUploadProps {
  interviewId: string;
  onUploadComplete?: () => void;
}

const ocrStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'blue', text: '待处理' },
  done: { color: 'green', text: '已完成' },
  failed: { color: 'red', text: '失败' },
};

export default function FileUpload({ interviewId, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadFiles = async () => {
    try {
      const res: any = await request.get(`/interviews/${interviewId}/files`);
      const list = res.data || res;
      setFiles(Array.isArray(list) ? list : []);
    } catch {
      message.error('加载文件列表失败');
    }
  };

  useEffect(() => {
    if (interviewId) loadFiles();
  }, [interviewId]);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      await request.post(`/interviews/${interviewId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('上传成功');
      loadFiles();
      onUploadComplete?.();
    } catch {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleReOcr = async (fileId: string) => {
    try {
      await request.post(`/interviews/${interviewId}/files/${fileId}/ocr`);
      message.success('已触发重新OCR');
      loadFiles();
    } catch {
      message.error('重新OCR失败');
    }
  };

  const handleDelete = async (fileId: string) => {
    try {
      await request.delete(`/interviews/${interviewId}/files/${fileId}`);
      message.success('删除成功');
      loadFiles();
    } catch {
      message.error('删除失败');
    }
  };

  return (
    <div>
      <Upload.Dragger
        accept=".jpg,.jpeg,.png,.pdf"
        showUploadList={false}
        beforeUpload={(file) => { handleUpload(file); return false; }}
        disabled={uploading}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">支持图片和PDF文件</p>
      </Upload.Dragger>

      <List
        style={{ marginTop: 16 }}
        dataSource={files}
        renderItem={(file: any) => {
          const ocrItem = ocrStatusMap[file.ocrStatus] || { color: 'default', text: file.ocrStatus };
          return (
            <List.Item
              actions={[
                <Button key="ocr" type="link" size="small" onClick={() => handleReOcr(file.id)}>
                  重新OCR
                </Button>,
                <Popconfirm
                  key="del"
                  title="确定删除此文件？"
                  onConfirm={() => handleDelete(file.id)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button type="link" danger size="small">删除</Button>
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={file.originalName || file.filename || '-'}
                description={
                  <Space>
                    <Tag color={ocrItem.color}>{ocrItem.text}</Tag>
                    {file.createdAt ? new Date(file.createdAt).toLocaleString() : ''}
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}
