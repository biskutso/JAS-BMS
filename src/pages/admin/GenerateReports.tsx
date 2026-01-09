// src/pages/admin/GenerateReports.tsx
import React, { useState } from 'react';
import DashboardHeader from '@components/dashboard/DashboardHeader';
import Button from '@components/common/Button';
import { formatCurrency } from '@utils/helpers';
import { supabase } from '../../supabaseClient';
import "../../assets/styles/dashboards.css";

interface ReportData {
  totalRevenue: number;
  bookingsCompleted: number;
  customersServed: number;
  popularService: { name: string; count: number };
  revenueByService: { service: string; revenue: number }[];
  dateRange: string;
  startDate: string;
  endDate: string;
}

type ReportPeriod = 'custom' | 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear';

const GenerateReports: React.FC = () => {
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('thisMonth');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get date range based on selected period
  const getDateRange = (period: ReportPeriod): { startDate: Date; endDate: Date } => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now);

    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'thisWeek':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'lastWeek':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay() - 7); // Start of last week
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of last week (Saturday)
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      
      case 'custom':
        // For custom dates, we'll use the provided dates
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default to this month if custom dates not set
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
        }
        break;
      
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  };

  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateRangeForDisplay = (startDate: Date, endDate: Date, period: ReportPeriod): string => {
    if (period === 'custom') {
      return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
    }
    
    switch (period) {
      case 'today':
      case 'yesterday':
        return formatDateForDisplay(startDate);
      case 'thisWeek':
      case 'lastWeek':
        return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
      case 'thisMonth':
      case 'lastMonth':
        return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'thisYear':
      case 'lastYear':
        return startDate.getFullYear().toString();
      default:
        return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`;
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReportData(null);

    try {
      // Validate custom dates if selected
      if (reportPeriod === 'custom') {
        if (!customStartDate || !customEndDate) {
          setError('Please select both start and end dates for custom range');
          setLoading(false);
          return;
        }
        
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        
        if (start > end) {
          setError('Start date must be before end date');
          setLoading(false);
          return;
        }
      }

      const { startDate, endDate } = getDateRange(reportPeriod);
      const dateRange = formatDateRangeForDisplay(startDate, endDate, reportPeriod);

      console.log('Fetching report data for:', { 
        reportPeriod, 
        startDate, 
        endDate,
        dateRange 
      });

      // Fetch bookings data - include total_price
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, customer_id, service_id, total_price, status, created_at, booking_date')
        .gte('booking_date', startDate.toISOString().split('T')[0])
        .lte('booking_date', endDate.toISOString().split('T')[0])
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
          dateRange,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        });
        return;
      }

      // Get service IDs from bookings
      const serviceIds = [...new Set(bookingsData.map(booking => booking.service_id).filter(Boolean))];
      console.log('Service IDs:', serviceIds);

      // Fetch services data for fallback prices and service names
      let servicesData: any[] = [];
      if (serviceIds.length > 0) {
        const { data: services, error: servicesError } = await supabase
          .from('services')
          .select('id, service_name, price')
          .in('id', serviceIds);

        if (servicesError) {
          console.error('Services fetch error:', servicesError);
          // Continue without services data - we'll use fallbacks
        } else {
          servicesData = services || [];
        }
      }

      console.log('Services data:', servicesData);

      // Create a map for quick service lookup (for names and fallback prices)
      const servicesMap = new Map(servicesData.map(service => [service.id, service]));

      // Calculate total revenue using booking.total_price FIRST
      const totalRevenue = bookingsData.reduce((sum, booking) => {
        const service = servicesMap.get(booking.service_id);
        // IMPORTANT: Use booking.total_price FIRST, then fallback to service price
        const bookingPrice = booking.total_price || service?.price || 0;
        return sum + (Number(bookingPrice) || 0);
      }, 0);

      const bookingsCompleted = bookingsData.length;
      
      // Count unique customers
      const customerIds = bookingsData.map(booking => booking.customer_id).filter(Boolean);
      const uniqueCustomers = new Set(customerIds);
      const customersServed = uniqueCustomers.size;

      // Calculate revenue by service and find popular service
      const serviceRevenue: { [key: string]: number } = {};
      const serviceCount: { [key: string]: number } = {};

      bookingsData.forEach(booking => {
        const service = servicesMap.get(booking.service_id);
        // Use service_name if available, otherwise create a generic name
        const serviceName = service?.service_name || 
                           `Service #${booking.service_id}` || 
                           'Unknown Service';
        
        // Use booking.total_price FIRST, then fallback to service price
        const bookingPrice = booking.total_price || service?.price || 0;

        serviceRevenue[serviceName] = (serviceRevenue[serviceName] || 0) + (Number(bookingPrice) || 0);
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
        dateRange,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
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
      ['Report Period', reportPeriod === 'custom' ? 'Custom Range' : reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)],
      ['Date Range', reportData.dateRange],
      ['Start Date', reportData.startDate],
      ['End Date', reportData.endDate],
      ['', ''],
      ['Total Revenue', formatCurrency(reportData.totalRevenue)],
      ['Bookings Completed', reportData.bookingsCompleted.toString()],
      ['Customers Served', reportData.customersServed.toString()],
      ['Most Popular Service', `${reportData.popularService.name} (${reportData.popularService.count} bookings)`],
      ['', ''],
      ['Revenue by Service', ''],
      ...reportData.revenueByService.map(item => [item.service, formatCurrency(item.revenue)]),
      ['', ''],
      ['Date Generated', new Date().toLocaleDateString()],
      ['Time Generated', new Date().toLocaleTimeString()]
    ];

    const csvContent = [headers, ...data]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spa-report-${reportPeriod}-${reportData.startDate}-to-${reportData.endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Set today's date as default for custom range
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  return (
    <div className="dashboard-layout-container">
      <div className="dashboard-main-content">
        <DashboardHeader title="Generate Reports" />
        
        <div className="dashboard-content-wrapper">
          <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
            {/* Generate detailed reports with custom date ranges. Select a predefined period or choose custom dates. */}<br/>
          </p>

          {/* Report Controls */}
          <div className="report-controls-container">
            <div className="report-controls">
              <div className="report-period-section">
                <label htmlFor="report-period" className="control-label">Report Period:</label>
                <select
                  id="report-period"
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                  className="report-select"
                  disabled={loading}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                  <option value="thisYear">This Year</option>
                  <option value="lastYear">Last Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Custom Date Range - Only show when custom is selected */}
              {reportPeriod === 'custom' && (
                <div className="custom-date-range-section">
                  <div className="date-input-group">
                    <label htmlFor="start-date" className="date-label">Start Date:</label>
                    <input
                      type="date"
                      id="start-date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="date-input"
                      max={today}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="date-input-group">
                    <label htmlFor="end-date" className="date-label">End Date:</label>
                    <input
                      type="date"
                      id="end-date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="date-input"
                      max={today}
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="date-quick-buttons">
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => {
                        setCustomStartDate(firstDayOfMonth);
                        setCustomEndDate(today);
                      }}
                      disabled={loading}
                    >
                      This Month
                    </Button>
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setCustomStartDate(yesterday.toISOString().split('T')[0]);
                        setCustomEndDate(yesterday.toISOString().split('T')[0]);
                      }}
                      disabled={loading}
                    >
                      Yesterday
                    </Button>
                    <Button 
                      variant="text" 
                      size="small" 
                      onClick={() => {
                        setCustomStartDate(today);
                        setCustomEndDate(today);
                      }}
                      disabled={loading}
                    >
                      Today
                    </Button>
                  </div>
                </div>
              )}

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
                  {reportPeriod === 'custom' ? 'Custom Range' : reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)} Performance Report
                </h3>
                <span className="report-date-range">
                  {reportData.dateRange}
                </span>
                <p className="report-date-detail">
                  {reportData.startDate} to {reportData.endDate}
                </p>
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
                For custom date ranges, select "Custom Range" and choose your dates.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GenerateReports;