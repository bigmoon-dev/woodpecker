import { useRef, useState } from 'react';
import { ProTable, type ActionType } from '@ant-design/pro-components';
import { Button, Upload, Modal, Form, Input, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../../utils/request';

export default function ScaleList() {
  const actionRef = useRef<ActionType>();
  const [importOpen, setImportOpen] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const navigate = useNavigate();

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => navigate(`/teacher/scales/${record.id}`)}>
          详情
        </Button>
      ),
    },
  ];

  const handleImport = async () => {
    if (!fileList.length) return message.warning('请选择文件');
    const formData = new FormData();
    formData.append('file', fileList[0]);
    try {
      await request.post('/scales/import', formData);
      message.success('导入成功');
      setImportOpen(false);
      setFileList([]);
      actionRef.current?.reload();
    } catch {
      message.error('导入失败');
    }
  };

  return (
    <>
      <ProTable
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res: any = await request.get('/scales', { params: { page: params.current, pageSize: params.pageSize } });
          return { data: res.data || res, total: res.total, success: true };
        }}
        toolBarRender={() => [
          <Button key="import" icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            导入量表
          </Button>,
        ]}
        search={false}
      />
      <Modal title="导入量表" open={importOpen} onOk={handleImport} onCancel={() => setImportOpen(false)}>
        <Upload beforeUpload={() => false} maxCount={1} fileList={fileList} onChange={({ fileList }) => setFileList(fileList)}>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Modal>
    </>
  );
}
