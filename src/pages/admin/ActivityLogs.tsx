import React, { useEffect, useState } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Table from '@components/dashboard/Table';
import Button from '@components/common/Button';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboards.css";

interface ActivityLog {
  id: number;
  created_at: string;
  actor_id: string;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  target_label: string | null;
  target_data: any | null;
}

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        // remove notification logs
        .neq('table_name', 'notifications')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      setLogs(data || []);
    } catch (err: any) {
      console.error('Failed to fetch logs:', err);
      setError(err.message || 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatDateTime = (dt: string) => {
    return new Date(dt).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const buildReadableTarget = (item: ActivityLog) => {
    const td = item.target_data || {};
    const fallback = item.target_label || 'N/A';

    switch ((item.table_name || '').toLowerCase()) {
      case 'services': {
        const name = td.service_name || 'Service';
        const cat = td.category || 'N/A';
        return `Service: ${name} (category: ${cat})`;
      }
      case 'inventory': {
        const name = td.name || 'Product';
        const cat = td.category || 'N/A';
        return `Product: ${name} (category: ${cat})`;
      }
      case 'inventory_transactions': {
        const product = td.product_name || 'Inventory Transaction';
        const type = td.transaction_type || 'N/A';
        const qty = td.quantity ?? 'N/A';
        return `Inventory Tx: ${product} (type: ${type}, qty: ${qty})`;
      }
      case 'walk_in_customers': {
        const name = td.name || 'Walk-in Customer';
        const phone = td.phone_num || 'N/A';
        return `Walk-in: ${name} (phone: ${phone})`;
      }
      case 'bookings': {
        const date = td.booking_date || 'N/A';
        const time = td.booking_time || 'N/A';
        const status = td.status || 'N/A';
        return `Booking: ${date} ${time} (status: ${status})`;
      }
      case 'users': {
        const email = td.email || 'N/A';
        const role = td.role || 'N/A';
        return `User profile: ${email} (role: ${role})`;
      }
      case 'auth': {
        return `Auth: ${item.action.toUpperCase()}`;
      }
      default:
        return fallback;
    }
  };

  const buildReadableSummary = (item: ActivityLog) => {
    const user = item.actor_name || 'Unknown';
    const role = item.actor_role || 'N/A';
    const target = buildReadableTarget(item);
    return `User: ${user} (role: ${role}) ; ${target}`;
  };

  const columns = [
    {
      header: 'User',
      key: 'user',
      render: (item: ActivityLog) => (
        <div className="activity-user">
          <div className="activity-username">{item.actor_name || 'Unknown'}</div>
          <div className="activity-userrole">role: {item.actor_role || 'N/A'}</div>
        </div>
      ),
      searchable: true,
      sortable: true
    },
    {
      header: 'Action',
      key: 'action',
      render: (item: ActivityLog) => (
        <span className={`activity-action-badge action-${item.action.toLowerCase()}`}>
          {item.action}
        </span>
      ),
      searchable: true,
      sortable: true
    },
    {
      header: 'Activity',
      key: 'activity',
      render: (item: ActivityLog) => (
        <div className="activity-summary">
          {buildReadableSummary(item)}
        </div>
      ),
      searchable: true,
      sortable: false
    },
    {
      header: 'Date & Time',
      key: 'datetime',
      render: (item: ActivityLog) => (
        <div className="activity-datetime">{formatDateTime(item.created_at)}</div>
      ),
      sortable: true
    }
  ];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Activity Logs" />

        <div className="dashboard-content-wrapper">
          {error && (
            <div className="dashboard-error">
              {error}
              <div className="dashboard-error-actions">
                <Button variant="text" size="small" onClick={fetchLogs}>
                  Try Again
                </Button>
              </div>
            </div>
          )}

          <div className="recent-bookings-section">
            <div className="recent-bookings-header">
              <h3 className="recent-bookings-title">System Activity Logs</h3>

              <div className="bookings-header-actions">
                <Button variant="secondary" size="small" onClick={fetchLogs} disabled={loading}>
                  🔄 Refresh
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="dashboard-loading">
                <p>Loading logs...</p>
              </div>
            ) : logs.length > 0 ? (
              <Table
                data={logs}
                columns={columns}
                emptyMessage="No activity logs found."
                searchPlaceholder="Search user, role, action or target..."
                showSearch={true}
                showPagination={true}
              />
            ) : (
              <div className="dashboard-empty-state">
                <p className="empty-state-message">No activity logs yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;
