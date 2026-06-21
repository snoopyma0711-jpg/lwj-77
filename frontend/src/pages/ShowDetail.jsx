import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Select,
  InputNumber,
  message,
  Drawer,
  Descriptions,
  List,
  Typography,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api.js';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

function ShowDetail() {
  const navigate = useNavigate();
  const { showId } = useParams();
  const [show, setShow] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [locks, setLocks] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [allocationLogs, setAllocationLogs] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addWaitlistVisible, setAddWaitlistVisible] = useState(false);
  const [logDetailVisible, setLogDetailVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [showRes, tiersRes, waitlistRes, locksRes, bookingsRes, logsRes, seatsRes, usersRes] = await Promise.all([
        api.get(`/shows/${showId}`),
        api.get(`/shows/${showId}/tiers`),
        api.get(`/shows/${showId}/waitlist`),
        api.get(`/shows/${showId}/locks`),
        api.get(`/shows/${showId}/bookings`),
        api.get(`/shows/${showId}/allocation-logs`),
        api.get(`/shows/${showId}/seats`),
        api.get('/users'),
      ]);
      setShow(showRes.data);
      setTiers(tiersRes.data);
      setWaitlist(waitlistRes.data);
      setLocks(locksRes.data);
      setBookings(bookingsRes.data);
      setAllocationLogs(logsRes.data);
      setSeats(seatsRes.data);
      setUsers(usersRes.data);
    } catch (e) {
      console.error(e);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      api.get('/health').catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [showId]);

  const handleAddWaitlist = async (values) => {
    try {
      await api.post('/waitlist', {
        userId: values.userId,
        showId,
        tierId: values.tierId,
        maxConsecutiveSeats: values.maxConsecutiveSeats || 1,
      });
      message.success('加入候补成功');
      setAddWaitlistVisible(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleCancelWaitlist = async (entryId) => {
    Modal.confirm({
      title: '确认取消候补？',
      content: '取消后该用户将从候补队列中移除，如有已锁定的名额也会释放',
      onOk: async () => {
        try {
          await api.delete(`/waitlist/${entryId}`);
          message.success('已取消候补');
          loadData();
        } catch (e) {
          message.error(e.response?.data?.error || '操作失败');
        }
      },
    });
  };

  const handleConfirmLock = async (lockId) => {
    Modal.confirm({
      title: '确认购票？',
      content: '确认后该锁定将转为正式购票',
      onOk: async () => {
        try {
          await api.post(`/locks/${lockId}/confirm`);
          message.success('确认成功');
          loadData();
        } catch (e) {
          message.error(e.response?.data?.error || '操作失败');
        }
      },
    });
  };

  const handleReleaseLock = async (lockId) => {
    Modal.confirm({
      title: '释放锁定？',
      content: '释放后名额会重新进入候补递补流程',
      onOk: async () => {
        try {
          await api.post(`/locks/${lockId}/release`);
          message.success('已释放');
          loadData();
        } catch (e) {
          message.error(e.response?.data?.error || '操作失败');
        }
      },
    });
  };

  const handleManualAllocate = async (tierId) => {
    try {
      await api.post(`/shows/${showId}/tiers/${tierId}/allocate`);
      message.success('已触发递补分配');
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '操作失败');
    }
  };

  const handleRefundSeat = (seatId) => {
    Modal.confirm({
      title: '确认退票？',
      content: '退票后系统将自动触发候补递补',
      onOk: async () => {
        try {
          const res = await api.post(`/seats/${seatId}/refund`);
          message.success(`退票成功，已触发递补 (日志ID: ${res.data.logId?.slice(0, 8)}...)`);
          loadData();
        } catch (e) {
          message.error(e.response?.data?.error || '操作失败');
        }
      },
    });
  };

  const viewLogDetail = async (logId) => {
    try {
      const res = await api.get(`/allocation-logs/${logId}`);
      setCurrentLog(res.data);
      setLogDetailVisible(true);
    } catch (e) {
      message.error('加载日志详情失败');
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      waiting: { color: 'blue', text: '等待中' },
      pending_confirmation: { color: 'orange', text: '待确认' },
      confirmed: { color: 'green', text: '已确认' },
      cancelled: { color: 'default', text: '已取消' },
      expired: { color: 'red', text: '已过期' },
      locked: { color: 'orange', text: '锁定中' },
      released: { color: 'default', text: '已释放' },
      confirmed_lock: { color: 'green', text: '已确认' },
      sold: { color: 'green', text: '已售出' },
      available: { color: 'blue', text: '可售' },
      admin_released: { color: 'default', text: '运营释放' },
      user_cancelled: { color: 'default', text: '用户取消' },
      timeout: { color: 'red', text: '超时释放' },
    };
    const cfg = statusMap[status] || { color: 'default', text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const waitlistColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: '票档',
      dataIndex: 'tier_id',
      key: 'tier_id',
      render: (tierId) => tiers.find(t => t.id === tierId)?.name || tierId,
    },
    {
      title: '连座需求',
      dataIndex: 'max_consecutive_seats',
      key: 'max_consecutive_seats',
      render: (n) => n > 1 ? `${n}连座` : '单座',
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" danger onClick={() => handleCancelWaitlist(record.id)}>
          取消候补
        </Button>
      ),
    },
  ];

  const lockColumns = [
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
    },
    {
      title: '连座数',
      dataIndex: 'consecutive_count',
      key: 'consecutive_count',
    },
    {
      title: '锁定时间',
      dataIndex: 'locked_at',
      key: 'locked_at',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (t) => {
        const isExpired = dayjs(t).isBefore(dayjs());
        return (
          <span style={{ color: isExpired ? 'red' : 'inherit' }}>
            {dayjs(t).format('MM-DD HH:mm:ss')}
          </span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.status !== 'locked') return null;
        return (
          <Space size="small">
            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleConfirmLock(record.id)}>
              确认
            </Button>
            <Button size="small" danger icon={<StopOutlined />} onClick={() => handleReleaseLock(record.id)}>
              释放
            </Button>
          </Space>
        );
      },
    },
  ];

  const logColumns = [
    {
      title: '触发时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '触发类型',
      dataIndex: 'trigger_type',
      key: 'trigger_type',
      render: (type) => {
        const typeMap = {
          refund: '退票触发',
          waitlist_cancel: '候补取消',
          new_waitlist: '新候补加入',
          manual_trigger: '手动触发',
          initial: '系统初始化',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '详情',
      dataIndex: 'trigger_detail',
      key: 'trigger_detail',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewLogDetail(record.id)}>
          查看详情
        </Button>
      ),
    },
  ];

  const seatsColumns = [
    {
      title: '座位号',
      key: 'seat',
      render: (_, record) => `${record.row_label}${record.seat_number}`,
    },
    {
      title: '票档',
      dataIndex: 'tier_id',
      key: 'tier_id',
      render: (tierId) => tiers.find(t => t.id === tierId)?.name || tierId,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        if (record.status === 'sold') {
          return (
            <Button size="small" danger onClick={() => handleRefundSeat(record.id)}>
              退票
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/shows')} style={{ marginRight: 16 }}>
          返回列表
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          刷新
        </Button>
      </div>

      {show && (
        <Card title={show.name} style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic title="演出时间" value={dayjs(show.date).format('YYYY-MM-DD HH:mm')} />
            </Col>
            <Col span={8}>
              <Statistic title="演出场馆" value={show.venue} />
            </Col>
            <Col span={8}>
              <Statistic
                title="候补总人数"
                value={waitlist.filter(w => w.status === 'waiting').length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card title="票档概览" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {tiers.map(tier => (
            <Col span={8} key={tier.id}>
              <Card size="small" title={tier.name} extra={<Tag color="blue">¥{tier.price}</Tag>}>
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">座区：</Text>
                    <Text>{tier.seat_section}</Text>
                  </div>
                  <div>
                    <Text type="secondary">总座位：</Text>
                    <Text>{tier.total_seats}</Text>
                  </div>
                  <div>
                    <Text type="secondary">已售出：</Text>
                    <Text style={{ color: '#52c41a' }}>{tier.sold_seats}</Text>
                  </div>
                  <div>
                    <Text type="secondary">锁定中：</Text>
                    <Text style={{ color: '#faad14' }}>{tier.locked_seats}</Text>
                  </div>
                  <div>
                    <Text type="secondary">可售：</Text>
                    <Text style={{ color: '#1890ff' }}>{tier.available_seats}</Text>
                  </div>
                  <div>
                    <Text type="secondary">候补中：</Text>
                    <Text style={{ color: '#722ed1' }}>{tier.waitlist_count}</Text>
                  </div>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleManualAllocate(tier.id)}
                    block
                  >
                    手动触发递补
                  </Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Tabs defaultActiveKey="waitlist">
        <TabPane tab="候补队列" key="waitlist">
          <div style={{ marginBottom: 12, textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddWaitlistVisible(true)}>
              添加候补
            </Button>
          </div>
          <Table
            rowKey="id"
            columns={waitlistColumns}
            dataSource={waitlist}
            loading={loading}
            pagination={false}
          />
        </TabPane>

        <TabPane tab="锁定记录" key="locks">
          <Table
            rowKey="id"
            columns={lockColumns}
            dataSource={locks}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>

        <TabPane tab="已确认订单" key="bookings">
          <Table
            rowKey="id"
            columns={[
              { title: '用户', dataIndex: 'user_name' },
              { title: '票档', dataIndex: 'tier_name' },
              { title: '连座数', dataIndex: 'consecutive_count' },
              {
                title: '确认时间',
                dataIndex: 'confirmed_at',
                render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
              },
            ]}
            dataSource={bookings}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>

        <TabPane tab="递补日志" key="logs">
          <Table
            rowKey="id"
            columns={logColumns}
            dataSource={allocationLogs}
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </TabPane>

        <TabPane tab="座位管理" key="seats">
          <Table
            rowKey="id"
            columns={seatsColumns}
            dataSource={seats}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
          />
        </TabPane>
      </Tabs>

      <Modal
        title="添加候补"
        open={addWaitlistVisible}
        onCancel={() => setAddWaitlistVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleAddWaitlist} layout="vertical">
          <Form.Item name="userId" label="选择用户" rules={[{ required: true, message: '请选择用户' }]}>
            <Select placeholder="请选择用户">
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tierId" label="选择票档" rules={[{ required: true, message: '请选择票档' }]}>
            <Select placeholder="请选择票档">
              {tiers.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.name} - ¥{t.price}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="maxConsecutiveSeats" label="最多接受连座数" initialValue={1}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>加入候补</Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="递补分配详情"
        width={600}
        open={logDetailVisible}
        onClose={() => setLogDetailVisible(false)}
      >
        {currentLog && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="触发时间">
                {dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="触发类型">
                {currentLog.trigger_type === 'refund' ? '退票触发' :
                 currentLog.trigger_type === 'manual_trigger' ? '手动触发' :
                 currentLog.trigger_type === 'waitlist_cancel' ? '候补取消' :
                 currentLog.trigger_type === 'new_waitlist' ? '新候补加入' :
                 currentLog.trigger_type === 'initial' ? '系统初始化' : currentLog.trigger_type}
              </Descriptions.Item>
              <Descriptions.Item label="触发详情">
                {currentLog.trigger_detail}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>分配过程</Title>
            <List
              dataSource={currentLog.items || []}
              renderItem={(item, index) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={item.action === 'allocated' ? 'green' : 'default'}>
                          #{item.rank}
                        </Tag>
                        <span>{item.user_name}</span>
                        {item.action === 'allocated' ? (
                          <Tag color="green">✓ 分配成功</Tag>
                        ) : (
                          <Tag color="orange">跳过</Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        <div>
                          <Text type="secondary">需求：</Text>
                          {item.consecutive > 1 ? `${item.consecutive}连座` : '单座'}
                          {item.seat_count > 0 && ` | 分配${item.seat_count}张`}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">原因：</Text>
                          <Text>{item.reason}</Text>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default ShowDetail;
