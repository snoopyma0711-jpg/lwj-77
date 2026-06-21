import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Drawer,
  Typography,
  Input,
  Row,
  Col,
  Statistic,
  Tabs,
  Badge,
  Tooltip,
  Avatar,
  Empty,
  Spin,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
  UserOutlined,
  ClockCircleOutlined,
  LockOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [overviewData, setOverviewData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userStatsMap, setUserStatsMap] = useState({});

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      const userList = res.data;
      setUsers(userList);

      const statsMap = {};
      await Promise.all(
        userList.map(async (u) => {
          try {
            const overviewRes = await api.get(`/users/${u.id}/overview`);
            const s = overviewRes.data.stats;
            statsMap[u.id] = {
              waitlist_count: s.waiting_count + s.pending_confirmation_count,
              lock_count: s.active_locks,
              booking_count: s.total_bookings,
            };
          } catch (e) {}
        })
      );
      setUserStatsMap(statsMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    const keyword = searchText.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(keyword) ||
        u.phone?.toLowerCase().includes(keyword)
    );
  }, [users, searchText]);

  const loadUserOverview = async (userId) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/users/${userId}/overview`);
      setOverviewData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const viewUserDetail = async (user) => {
    setDetailVisible(true);
    setOverviewData(null);
    await loadUserOverview(user.id);
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
      timeout: { color: 'red', text: '超时释放' },
      admin_released: { color: 'default', text: '运营释放' },
      user_cancelled: { color: 'default', text: '用户取消' },
    };
    const cfg = statusMap[status] || { color: 'default', text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const getTimeRemaining = (expiresAt) => {
    const now = dayjs();
    const expire = dayjs(expiresAt);
    const diff = expire.diff(now, 'second');
    if (diff <= 0) return { text: '已超时', danger: true, warn: false };
    if (diff <= 60) return { text: `${diff}秒后过期`, danger: true, warn: true };
    if (diff <= 300) return { text: `${Math.floor(diff / 60)}分${diff % 60}秒后过期`, danger: false, warn: true };
    return { text: `${Math.floor(diff / 60)}分钟后过期`, danger: false, warn: false };
  };

  const waitlistColumns = [
    {
      title: '演出名称',
      dataIndex: 'show_name',
      key: 'show_name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.show_venue} · {dayjs(record.show_date).format('MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
      render: (t) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '连座需求',
      dataIndex: 'max_consecutive_seats',
      key: 'max_consecutive_seats',
      render: (n) => (n > 1 ? `${n}连座` : '单座'),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
      width: 140,
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
        <Button
          size="small"
          onClick={() => navigate(`/shows/${record.show_id}`)}
        >
          去演出页
        </Button>
      ),
    },
  ];

  const lockColumns = [
    {
      title: '演出名称',
      dataIndex: 'show_name',
      key: 'show_name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.show_venue} · {dayjs(record.show_date).format('MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
      render: (t) => <Tag color="orange">{t}</Tag>,
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
      width: 140,
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (t, record) => {
        const remaining = getTimeRemaining(t);
        let bgColor = 'transparent';
        let textColor = 'inherit';
        if (record.status === 'locked') {
          if (remaining.danger) {
            bgColor = '#fff1f0';
            textColor = '#ff4d4f';
          } else if (remaining.warn) {
            bgColor = '#fffbe6';
            textColor = '#d46b08';
          }
        }
        return (
          <div
            style={{
              background: bgColor,
              padding: '4px 8px',
              borderRadius: 4,
              display: 'inline-block',
            }}
          >
            <Space direction="vertical" size={0}>
              <Text style={{ color: textColor }}>
                {dayjs(t).format('MM-DD HH:mm:ss')}
              </Text>
              {record.status === 'locked' && (
                <Text type="secondary" style={{ fontSize: 12, color: textColor }}>
                  {remaining.text}
                </Text>
              )}
            </Space>
          </div>
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
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => navigate(`/shows/${record.show_id}`)}
        >
          去演出页
        </Button>
      ),
    },
  ];

  const bookingColumns = [
    {
      title: '演出名称',
      dataIndex: 'show_name',
      key: 'show_name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.show_venue} · {dayjs(record.show_date).format('MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
      render: (t) => <Tag color="green">{t}</Tag>,
    },
    {
      title: '连座数',
      dataIndex: 'consecutive_count',
      key: 'consecutive_count',
    },
    {
      title: '确认时间',
      dataIndex: 'confirmed_at',
      key: 'confirmed_at',
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
      width: 140,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          size="small"
          onClick={() => navigate(`/shows/${record.show_id}`)}
        >
          去演出页
        </Button>
      ),
    },
  ];

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '候补中',
      key: 'waitlist_count',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const stats = userStatsMap[record.id];
        return (
          <Badge
            count={stats?.waitlist_count ?? 0}
            showZero
            style={{ backgroundColor: '#1890ff' }}
          />
        );
      },
    },
    {
      title: '锁定中',
      key: 'lock_count',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const stats = userStatsMap[record.id];
        return (
          <Badge
            count={stats?.lock_count ?? 0}
            showZero
            style={{ backgroundColor: stats?.lock_count > 0 ? '#faad14' : '#d9d9d9' }}
          />
        );
      },
    },
    {
      title: '已确认',
      key: 'booking_count',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const stats = userStatsMap[record.id];
        return (
          <Badge
            count={stats?.booking_count ?? 0}
            showZero
            style={{ backgroundColor: stats?.booking_count > 0 ? '#52c41a' : '#d9d9d9' }}
          />
        );
      },
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm'),
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => viewUserDetail(record)}
        >
          全维度排查
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            用户管理
          </Title>
          <Tooltip title="按用户维度排查候补、锁定、确认情况">
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
        <Space>
          <Input
            placeholder="搜索用户名/手机号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadUsers}>
            刷新
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={userColumns}
        dataSource={filteredUsers}
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
      />

      <Drawer
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>
              用户全维度排查
            </Title>
            {overviewData?.user && (
              <Tag color="blue">
                {overviewData.user.name} | {overviewData.user.phone}
              </Tag>
            )}
          </Space>
        }
        width={900}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        extra={
          <Button onClick={() => overviewData?.user && loadUserOverview(overviewData.user.id)}>
            <ReloadOutlined /> 刷新
          </Button>
        }
      >
        {overviewData ? (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={5}>
                  <Statistic
                    title={
                      <Space>
                        <ClockCircleOutlined style={{ color: '#1890ff' }} />
                        候补记录
                      </Space>
                    }
                    value={overviewData.stats.total_waitlist}
                    suffix="条"
                  />
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <Tag color="blue">等待中 {overviewData.stats.waiting_count}</Tag>
                    <Tag color="orange">待确认 {overviewData.stats.pending_confirmation_count}</Tag>
                  </div>
                </Col>
                <Col span={5}>
                  <Statistic
                    title={
                      <Space>
                        <LockOutlined style={{ color: '#faad14' }} />
                        锁定记录
                      </Space>
                    }
                    value={overviewData.stats.active_locks}
                    suffix="个有效"
                    valueStyle={{ color: '#faad14' }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <Text type="secondary">历史锁定 {overviewData.stats.total_locks} 次</Text>
                  </div>
                </Col>
                <Col span={5}>
                  <Statistic
                    title={
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        已确认订单
                      </Space>
                    }
                    value={overviewData.stats.total_bookings}
                    suffix="笔"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={9}>
                  <Title level={5} style={{ marginTop: 0 }}>用户信息</Title>
                  <Space direction="vertical" size={4}>
                    <Text>
                      <Text type="secondary">用户名：</Text>
                      {overviewData.user.name}
                    </Text>
                    <Text>
                      <Text type="secondary">手机号：</Text>
                      {overviewData.user.phone}
                    </Text>
                    <Text>
                      <Text type="secondary">注册时间：</Text>
                      {dayjs(overviewData.user.created_at).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                  </Space>
                </Col>
              </Row>
            </Card>

            {overviewData.stats.active_locks > 0 && (
              <Alert
                message={
                  <Space>
                    <WarningOutlined />
                    注意：该用户当前有 {overviewData.stats.active_locks} 个锁定名额占座中！
                  </Space>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Tabs defaultActiveKey="waitlist" size="large">
              <TabPane
                tab={
                  <Space>
                    <Badge
                      count={overviewData.waitlist.length}
                      showZero
                      style={{ backgroundColor: '#1890ff' }}
                    />
                    候补记录 ({overviewData.waitlist.length})
                  </Space>
                }
                key="waitlist"
              >
                {overviewData.waitlist.length > 0 ? (
                  <Table
                    rowKey="id"
                    columns={waitlistColumns}
                    dataSource={overviewData.waitlist}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无候补记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <Badge
                      count={overviewData.locks.length}
                      showZero
                      style={{ backgroundColor: '#faad14' }}
                    />
                    锁定记录 ({overviewData.locks.length})
                  </Space>
                }
                key="locks"
              >
                {overviewData.locks.length > 0 ? (
                  <Table
                    rowKey="id"
                    columns={lockColumns}
                    dataSource={overviewData.locks}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无锁定记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>

              <TabPane
                tab={
                  <Space>
                    <Badge
                      count={overviewData.bookings.length}
                      showZero
                      style={{ backgroundColor: '#52c41a' }}
                    />
                    已确认订单 ({overviewData.bookings.length})
                  </Space>
                }
                key="bookings"
              >
                {overviewData.bookings.length > 0 ? (
                  <Table
                    rowKey="id"
                    columns={bookingColumns}
                    dataSource={overviewData.bookings}
                    pagination={{ pageSize: 5 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无确认订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </TabPane>
            </Tabs>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            {detailLoading ? (
              <Space direction="vertical" size="middle" align="center">
                <Spin size="large" />
                <Text type="secondary">加载用户全维度数据中...</Text>
              </Space>
            ) : (
              <Empty description="数据加载失败" />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default Users;
