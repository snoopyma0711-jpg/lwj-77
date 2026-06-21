import React, { useState, useEffect, useMemo } from 'react';
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
  Input,
  Tooltip,
  Badge,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
  PlayCircleOutlined,
  FilterOutlined,
  UserOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api.js';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

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

  const [waitlistTierFilter, setWaitlistTierFilter] = useState(undefined);
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState(undefined);
  const [waitlistSearchText, setWaitlistSearchText] = useState('');
  const [lockTierFilter, setLockTierFilter] = useState(undefined);
  const [lockStatusFilter, setLockStatusFilter] = useState(undefined);
  const [lockSearchText, setLockSearchText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [showRes, tiersRes, usersRes] = await Promise.all([
        api.get(`/shows/${showId}`),
        api.get(`/shows/${showId}/tiers`),
        api.get('/users'),
      ]);
      setShow(showRes.data);
      setTiers(tiersRes.data);
      setUsers(usersRes.data);
      await Promise.all([
        loadWaitlist(),
        loadLocks(),
        loadBookings(),
        loadAllocationLogs(),
        loadSeats(),
      ]);
    } catch (e) {
      console.error(e);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadWaitlist = async () => {
    try {
      const params = {};
      if (waitlistTierFilter) params.tierId = waitlistTierFilter;
      if (waitlistStatusFilter) params.status = waitlistStatusFilter;
      const res = await api.get(`/shows/${showId}/waitlist`, { params });
      setWaitlist(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadLocks = async () => {
    try {
      const params = {};
      if (lockTierFilter) params.tierId = lockTierFilter;
      if (lockStatusFilter) params.status = lockStatusFilter;
      const res = await api.get(`/shows/${showId}/locks`, { params });
      setLocks(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadBookings = async () => {
    try {
      const res = await api.get(`/shows/${showId}/bookings`);
      setBookings(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllocationLogs = async () => {
    try {
      const res = await api.get(`/shows/${showId}/allocation-logs`);
      setAllocationLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSeats = async () => {
    try {
      const res = await api.get(`/shows/${showId}/seats`);
      setSeats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      api.get('/health').catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [showId]);

  useEffect(() => {
    loadWaitlist();
  }, [waitlistTierFilter, waitlistStatusFilter]);

  useEffect(() => {
    loadLocks();
  }, [lockTierFilter, lockStatusFilter]);

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
      loadWaitlist();
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
          loadWaitlist();
          loadLocks();
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
          loadLocks();
          loadBookings();
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
          loadLocks();
          loadWaitlist();
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
      loadWaitlist();
      loadLocks();
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
          loadSeats();
          loadWaitlist();
          loadLocks();
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

  const getTimeRemaining = (expiresAt) => {
    const now = dayjs();
    const expire = dayjs(expiresAt);
    const diff = expire.diff(now, 'second');
    if (diff <= 0) return { text: '已超时', danger: true, warn: false, minutes: 0 };
    if (diff <= 60) return { text: `${diff}秒后过期`, danger: true, warn: true, minutes: Math.ceil(diff / 60) };
    if (diff <= 300) return { text: `${Math.floor(diff / 60)}分${diff % 60}秒后过期`, danger: false, warn: true, minutes: Math.ceil(diff / 60) };
    return { text: `${Math.floor(diff / 60)}分钟后过期`, danger: false, warn: false, minutes: Math.ceil(diff / 60) };
  };

  const filteredWaitlist = useMemo(() => {
    if (!waitlistSearchText) return waitlist;
    const kw = waitlistSearchText.toLowerCase();
    return waitlist.filter(
      (w) =>
        w.user_name?.toLowerCase().includes(kw) ||
        w.user_phone?.toLowerCase().includes(kw)
    );
  }, [waitlist, waitlistSearchText]);

  const filteredLocks = useMemo(() => {
    if (!lockSearchText) return locks;
    const kw = lockSearchText.toLowerCase();
    return locks.filter(
      (l) =>
        l.user_name?.toLowerCase().includes(kw) ||
        l.user_phone?.toLowerCase().includes(kw)
    );
  }, [locks, lockSearchText]);

  const sortedLocks = useMemo(() => {
    return [...filteredLocks].sort((a, b) => {
      if (a.status === 'locked' && b.status === 'locked') {
        return dayjs(a.expires_at).valueOf() - dayjs(b.expires_at).valueOf();
      }
      if (a.status === 'locked') return -1;
      if (b.status === 'locked') return 1;
      return dayjs(b.locked_at).valueOf() - dayjs(a.locked_at).valueOf();
    });
  }, [filteredLocks]);

  const urgentLocksCount = useMemo(() => {
    return locks.filter((l) => {
      if (l.status !== 'locked') return false;
      const remaining = getTimeRemaining(l.expires_at);
      return remaining.danger || remaining.warn;
    }).length;
  }, [locks]);

  const waitlistColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      fixed: 'left',
      render: (_, __, index) => (
        <Tag color={index < 3 ? '#f5222d' : 'blue'} style={{ fontWeight: 'bold' }}>
          #{index + 1}
        </Tag>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.user_phone && (
            <Tooltip title={record.user_phone}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({record.user_phone})
              </Text>
            </Tooltip>
          )}
          <Link
            to={`/users`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/users');
            }}
            style={{ fontSize: 12 }}
          >
            <UserOutlined /> 排查
          </Link>
        </Space>
      ),
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
      width: 120,
      render: (t) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '连座需求',
      dataIndex: 'max_consecutive_seats',
      key: 'max_consecutive_seats',
      width: 100,
      render: (n) => (n > 1 ? `${n}连座` : '单座'),
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 150,
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '等待时长',
      dataIndex: 'submitted_at',
      key: 'wait_time',
      width: 110,
      render: (t) => {
        const hours = dayjs().diff(dayjs(t), 'hour');
        if (hours < 1) return `${dayjs().diff(dayjs(t), 'minute')}分钟`;
        if (hours < 24) return `${hours}小时`;
        return `${Math.floor(hours / 24)}天${hours % 24}小时`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_, record) => (
        <Button size="small" danger onClick={() => handleCancelWaitlist(record.id)}>
          取消候补
        </Button>
      ),
    },
  ];

  const lockColumns = [
    {
      title: '紧急度',
      key: 'urgency',
      width: 80,
      fixed: 'left',
      render: (_, record) => {
        if (record.status !== 'locked') return null;
        const remaining = getTimeRemaining(record.expires_at);
        if (remaining.danger) {
          return (
            <Tooltip title="即将超时，请立即处理">
              <Badge status="error" text={<span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>紧急</span>} />
            </Tooltip>
          );
        }
        if (remaining.warn) {
          return (
            <Tooltip title="剩余时间不足5分钟">
              <Badge status="warning" text={<span style={{ color: '#d46b08' }}>注意</span>} />
            </Tooltip>
          );
        }
        return <Badge status="processing" text={<span style={{ color: '#1890ff' }}>正常</span>} />;
      },
    },
    {
      title: '用户',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {record.user_phone && (
            <Tooltip title={record.user_phone}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({record.user_phone})
              </Text>
            </Tooltip>
          )}
          <Link
            to={`/users`}
            onClick={(e) => {
              e.preventDefault();
              navigate('/users');
            }}
            style={{ fontSize: 12 }}
          >
            <UserOutlined /> 排查
          </Link>
        </Space>
      ),
    },
    {
      title: '票档',
      dataIndex: 'tier_name',
      key: 'tier_name',
      width: 120,
      render: (t) => <Tag color="orange">{t}</Tag>,
    },
    {
      title: '连座数',
      dataIndex: 'consecutive_count',
      key: 'consecutive_count',
      width: 90,
    },
    {
      title: '锁定时间',
      dataIndex: 'locked_at',
      key: 'locked_at',
      width: 150,
      render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '过期时间 / 倒计时',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 200,
      render: (t, record) => {
        const remaining = getTimeRemaining(t);
        let bgColor = 'transparent';
        let borderColor = 'transparent';
        let textColor = 'inherit';
        if (record.status === 'locked') {
          if (remaining.danger) {
            bgColor = '#fff1f0';
            borderColor = '#ffa39e';
            textColor = '#ff4d4f';
          } else if (remaining.warn) {
            bgColor = '#fffbe6';
            borderColor = '#ffe58f';
            textColor = '#d46b08';
          }
        }
        return (
          <div
            style={{
              background: bgColor,
              padding: '6px 10px',
              borderRadius: 6,
              border: `1px solid ${borderColor}`,
              display: 'inline-block',
              minWidth: 160,
            }}
          >
            <Space direction="vertical" size={2}>
              <Text style={{ color: textColor, fontWeight: 500 }}>
                {dayjs(t).format('MM-DD HH:mm:ss')}
              </Text>
              {record.status === 'locked' && (
                <Text type="secondary" style={{ fontSize: 12, color: textColor }}>
                  ⏱ {remaining.text}
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
      width: 100,
      render: getStatusTag,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
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
      render: (tierId) => tiers.find((t) => t.id === tierId)?.name || tierId,
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
          刷新全部
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
                value={waitlist.filter((w) => w.status === 'waiting').length}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      <Card title="票档概览" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {tiers.map((tier) => (
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

      <Tabs defaultActiveKey="waitlist" size="large">
        <TabPane
          tab={
            <Space>
              候补队列
              <Badge count={waitlist.length} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          }
          key="waitlist"
        >
          <Card
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <FilterOutlined />
                筛选条件
              </Space>
            }
            extra={
              <Space>
                <Input
                  placeholder="搜索用户名/手机号"
                  prefix={<SearchOutlined />}
                  value={waitlistSearchText}
                  onChange={(e) => setWaitlistSearchText(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                <Select
                  placeholder="全部票档"
                  value={waitlistTierFilter}
                  onChange={setWaitlistTierFilter}
                  style={{ width: 150 }}
                  allowClear
                >
                  {tiers.map((t) => (
                    <Option key={t.id} value={t.id}>
                      {t.name}
                    </Option>
                  ))}
                </Select>
                <Select
                  placeholder="全部状态"
                  value={waitlistStatusFilter}
                  onChange={setWaitlistStatusFilter}
                  style={{ width: 130 }}
                  allowClear
                >
                  <Option value="waiting">等待中</Option>
                  <Option value="pending_confirmation">待确认</Option>
                  <Option value="confirmed">已确认</Option>
                  <Option value="cancelled">已取消</Option>
                  <Option value="expired">已过期</Option>
                </Select>
                <Button
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => setAddWaitlistVisible(true)}
                >
                  添加候补
                </Button>
              </Space>
            }
          />
          <Table
            rowKey="id"
            columns={waitlistColumns}
            dataSource={filteredWaitlist}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
            scroll={{ x: 1000 }}
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              锁定记录
              <Badge count={locks.length} style={{ backgroundColor: '#faad14' }} />
              {urgentLocksCount > 0 && (
                <Tooltip title={`有 ${urgentLocksCount} 个锁定即将超时`}>
                  <Badge
                    count={urgentLocksCount}
                    style={{ backgroundColor: '#ff4d4f' }}
                  />
                </Tooltip>
              )}
            </Space>
          }
          key="locks"
        >
          {urgentLocksCount > 0 && (
            <Alert
              message={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <strong>注意：有 {urgentLocksCount} 个锁定即将超时，请尽快确认或释放！</strong>
                </Space>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              action={
                <Button size="small" type="primary" onClick={loadLocks}>
                  刷新列表
                </Button>
              }
            />
          )}
          <Card
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <FilterOutlined />
                筛选条件
                <Tooltip title="默认按紧急度排序：即将超时的在前">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    (按紧急度排序)
                  </Text>
                </Tooltip>
              </Space>
            }
            extra={
              <Space>
                <Input
                  placeholder="搜索用户名/手机号"
                  prefix={<SearchOutlined />}
                  value={lockSearchText}
                  onChange={(e) => setLockSearchText(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                <Select
                  placeholder="全部票档"
                  value={lockTierFilter}
                  onChange={setLockTierFilter}
                  style={{ width: 150 }}
                  allowClear
                >
                  {tiers.map((t) => (
                    <Option key={t.id} value={t.id}>
                      {t.name}
                    </Option>
                  ))}
                </Select>
                <Select
                  placeholder="全部状态"
                  value={lockStatusFilter}
                  onChange={setLockStatusFilter}
                  style={{ width: 130 }}
                  allowClear
                >
                  <Option value="locked">锁定中</Option>
                  <Option value="released">已释放</Option>
                  <Option value="confirmed_lock">已确认</Option>
                  <Option value="timeout">超时释放</Option>
                  <Option value="admin_released">运营释放</Option>
                  <Option value="user_cancelled">用户取消</Option>
                </Select>
                <Button icon={<ReloadOutlined />} onClick={loadLocks}>
                  刷新
                </Button>
              </Space>
            }
          />
          <Table
            rowKey="id"
            columns={lockColumns}
            dataSource={sortedLocks}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
            scroll={{ x: 1100 }}
            rowClassName={(record) => {
              if (record.status !== 'locked') return '';
              const remaining = getTimeRemaining(record.expires_at);
              if (remaining.danger) return 'lock-danger-row';
              if (remaining.warn) return 'lock-warn-row';
              return '';
            }}
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              已确认订单
              <Badge count={bookings.length} style={{ backgroundColor: '#52c41a' }} />
            </Space>
          }
          key="bookings"
        >
          <Table
            rowKey="id"
            columns={[
              { title: '用户', dataIndex: 'user_name' },
              { title: '票档', dataIndex: 'tier_name', render: (t) => <Tag color="green">{t}</Tag> },
              { title: '连座数', dataIndex: 'consecutive_count' },
              {
                title: '确认时间',
                dataIndex: 'confirmed_at',
                render: (t) => dayjs(t).format('MM-DD HH:mm:ss'),
              },
            ]}
            dataSource={bookings}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
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
            <Select placeholder="请选择用户" showSearch optionFilterProp="children">
              {users.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.name} {u.phone ? `(${u.phone})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tierId" label="选择票档" rules={[{ required: true, message: '请选择票档' }]}>
            <Select placeholder="请选择票档">
              {tiers.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.name} - ¥{t.price}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="maxConsecutiveSeats" label="最多接受连座数" initialValue={1}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              加入候补
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="递补分配详情" width={600} open={logDetailVisible} onClose={() => setLogDetailVisible(false)}>
        {currentLog && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="触发时间">
                {dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="触发类型">
                {currentLog.trigger_type === 'refund'
                  ? '退票触发'
                  : currentLog.trigger_type === 'manual_trigger'
                  ? '手动触发'
                  : currentLog.trigger_type === 'waitlist_cancel'
                  ? '候补取消'
                  : currentLog.trigger_type === 'new_waitlist'
                  ? '新候补加入'
                  : currentLog.trigger_type === 'initial'
                  ? '系统初始化'
                  : currentLog.trigger_type}
              </Descriptions.Item>
              <Descriptions.Item label="触发详情">{currentLog.trigger_detail}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>分配过程</Title>
            <List
              dataSource={currentLog.items || []}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={item.action === 'allocated' ? 'green' : 'default'}>#{item.rank}</Tag>
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

      <style>
        {`
          .lock-danger-row td {
            background-color: #fff1f0 !important;
          }
          .lock-danger-row:hover > td {
            background-color: #fff1f0 !important;
          }
          .lock-warn-row td {
            background-color: #fffbe6 !important;
          }
          .lock-warn-row:hover > td {
            background-color: #fffbe6 !important;
          }
        `}
      </style>
    </div>
  );
}

export default ShowDetail;
