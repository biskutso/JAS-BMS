// src/pages/admin/GenerateReports.tsx
import React, { useState } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Button from '@components/common/Button';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';

interface ReportData {
  totalRevenue: number;
  bookingsCompleted: number;
  customersServed: number;
  popularService: { name: string; count: number };
  revenueByService: { service: string; revenue: number }[];
  dateRange: string;
}

const GenerateReports: React.FC = () => {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = (type: 'daily' | 'monthly' | 'yearly') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (type) {
      case 'daily':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate, endDate };
  };

  const formatDateRange = (startDate: Date, endDate: Date, type: 'daily' | 'monthly' | 'yearly') => {
    switch (type) {
      case 'daily':
        return startDate.toLocaleDateString();
      case 'monthly':
        return `${startDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}`;
      case 'yearly':
        return startDate.getFullYear().toString();
      default:
        return '';
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      const { startDate, endDate } = getDateRange(reportType);
      const dateRange = formatDateRange(startDate, endDate, reportType);

      console.log('Fetching report data for:', { reportType, startDate, endDate });

      // Fetch bookings data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .eq('status', 'completed');

      if (bookingsError) {
        console.error('Bookings fetch error:', bookingsError);
        throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
      }

      console.log('Bookings data:', bookingsData);

      if (!bookingsData || bookingsData.length === 0) {
        setReportData({
          totalRevenue: 0,
          bookingsCompleted: 0,
          customersServed: 0,
          popularService: { name: 'No data', count: 0 },
          revenueByService: [],
          dateRange
        });
        return;
      }

      // Get service IDs from bookings
      const serviceIds = [...new Set(bookingsData.map(booking => booking.service_id).filter(Boolean))];
      console.log('Service IDs:', serviceIds);

      // Fetch services data with correct column names
      let servicesData: any[] = [];
      if (serviceIds.length > 0) {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('id, service_name, price') // Use service_name instead of name
          .in('id', serviceIds);

        if (servicesError) {
          console.error('Services fetch error:', servicesError);
          // Continue without services data - we'll use fallbacks
        } else {
          servicesData = services || [];
        }
      }

      console.log('Services data:', servicesData);

      // Create a map for quick service lookup
      const servicesMap = new Map(servicesData.map(service => [service.id, service]));

      // Calculate metrics
      const totalRevenue = bookingsData.reduce((sum, booking) => {
        const service = servicesMap.get(booking.service_id);
        // Use service price, or total_amount from booking, or fallback to 0
        const servicePrice = service?.price || booking.total_amount || booking.amount || 0;
        return sum + servicePrice;
      }, 0);

      const bookingsCompleted = bookingsData.length;
      
      // Count unique customers (handle both customer_id and user_id)
      const customerIds = bookingsData.map(booking => 
        booking.customer_id || booking.user_id
      ).filter(Boolean);
      const uniqueCustomers = new Set(customerIds);
      const customersServed = uniqueCustomers.size;

      // Calculate revenue by service and find popular service
      const serviceRevenue: { [key: string]: number } = {};
      const serviceCount: { [key: string]: number } = {};

      bookingsData.forEach(booking => {
        const service = servicesMap.get(booking.service_id);
        // Use service_name if available, otherwise create a generic name
        const serviceName = service?.service_name || 
                           service?.name || 
                           `Service #${booking.service_id}` || 
                           'Unknown Service';
        
        const servicePrice = service?.price || booking.total_amount || booking.amount || 0;

        serviceRevenue[serviceName] = (serviceRevenue[serviceName] || 0) + servicePrice;
        serviceCount[serviceName] = (serviceCount[serviceName] || 0) + 1;
      });

      const revenueByService = Object.entries(serviceRevenue).map(([service, revenue]) => ({
        service,
        revenue
      })).sort((a, b) => b.revenue - a.revenue);

      // Find most popular service
      let popularService = { name: 'No data', count: 0 };
      if (Object.keys(serviceCount).length > 0) {
        const [mostPopularName, mostPopularCount] = Object.entries(serviceCount)
          .reduce((max, [name, count]) => count > max[1] ? [name, count] : max, ['', 0]);
        popularService = { name: mostPopularName, count: mostPopularCount };
      }

      console.log('Calculated metrics:', {
        totalRevenue,
        bookingsCompleted,
        customersServed,
        popularService,
        revenueByService
      });

      setReportData({
        totalRevenue,
        bookingsCompleted,
        customersServed,
        popularService,
        revenueByService,
        dateRange
      });

    } catch (err: any) {
      console.error('Report generation error:', err);
      setError(err.message || 'Failed to generate report. Please check your database configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData) return;

    const headers = ['Metric', 'Value'];
    const data = [
      ['Total Revenue', formatCurrency(reportData.totalRevenue)],
      ['Bookings Completed', reportData.bookingsCompleted.toString()],
      ['Customers Served', reportData.customersServed.toString()],
      ['Most Popular Service', `${reportData.popularService.name} (${reportData.popularService.count} bookings)`],
      ['', ''],
      ['Revenue by Service', ''],
      ...reportData.revenueByService.map(item => [item.service, formatCurrency(item.revenue)]),
      ['', ''],
      ['Report Period', reportType.charAt(0).toUpperCase() + reportType.slice(1)],
      ['Date Range', reportData.dateRange],
      ['Date Generated', new Date().toLocaleDateString()]
    ];

    const csvContent = [headers, ...data]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spa-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Generate Reports" />
        
        <div className="dashboard-content-wrapper">
          <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
            Access insights into your business performance, revenue, and service popularity.
          </p>

          {/* Database Info */}
          <div className="info-banner">
            <p style={{ margin: 0, color: '#0066cc' }}>
              <strong>Database Info:</strong> Using your actual booking data. Make sure you have:
            </p>
            <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
              <li>Completed bookings in the 'bookings' table</li>
              <li>Service information in the 'services' table</li>
              <li>Proper status fields and pricing data</li>
            </ul>
          </div>

          {/* Report Controls */}
          <div className="report-controls-container">
            <div className="report-controls">
              <label htmlFor="report-type" className="control-label">Report Period:</label>
              <select
                id="report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as 'daily' | 'monthly' | 'yearly')}
                className="report-select"
                disabled={loading}
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <div className="report-buttons">
                <Button 
                  variant="primary" 
                  onClick={handleGenerateReport} 
                  disabled={loading}
                  className="generate-button"
                >
                  {loading ? 'Generating...' : 'Generate Report'}
                </Button>
                {reportData && (
                  <Button variant="secondary" onClick={handleExportCSV} className="export-button">
                    Export CSV
                  </Button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="dashboard-error">
              {error}
            </div>
          )}

          {reportData && (
            <div className="report-results-container">
              <div className="report-header">
                <h3 className="report-title">
                  {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Performance Report
                </h3>
                <span className="report-date-range">
                  {reportData.dateRange}
                </span>
              </div>

              {/* Key Metrics */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <p className="metric-label">Total Revenue</p>
                  <p className="metric-value">
                    {formatCurrency(reportData.totalRevenue)}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Bookings Completed</p>
                  <p className="metric-value">
                    {reportData.bookingsCompleted}
                  </p>
                </div>
                <div className="metric-card">
                  <p className="metric-label">Customers Served</p>
                  <p className="metric-value">
                    {reportData.customersServed}
                  </p>
                </div>
              </div>

              {/* Revenue by Service */}
              {reportData.revenueByService.length > 0 && (
                <div className="revenue-section">
                  <h4 className="section-title">
                    Revenue by Service
                  </h4>
                  <div className="revenue-list">
                    {reportData.revenueByService.map((item, index) => (
                      <div key={index} className="revenue-item">
                        <span className="service-name">{item.service}</span>
                        <span className="service-revenue">
                          {formatCurrency(item.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Service */}
              <div className="popular-service-card">
                <p className="popular-service-text">
                  Most Popular Service: <strong>{reportData.popularService.name}</strong> 
                  {' '}({reportData.popularService.count} {reportData.popularService.count === 1 ? 'booking' : 'bookings'})
                </p>
              </div>

              {/* Report Summary */}
              <div className="report-footer">
                Report generated on {new Date().toLocaleString()}
              </div>
            </div>
          )}

          {!reportData && !loading && (
            <div className="empty-report-state">
              <p>Select a report period and click "Generate Report" to view your business insights.</p>
              <p className="empty-report-subtext">
                The report will show completed bookings data from your database.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateReports;