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
    <>
      <DashboardHeader title="Generate Reports" />
      <div className="page-container">
        <p className="section-subtitle" style={{textAlign: 'left', marginBottom: 'var(--spacing-lg)'}}>
          Access insights into your business performance, revenue, and service popularity.
        </p>

        {/* Database Info */}
        <div style={{ 
          backgroundColor: '#f0f8ff', 
          border: '1px solid #b3d9ff',
          borderRadius: 'var(--border-radius-sm)',
          padding: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)',
          fontSize: '0.9rem'
        }}>
          <p style={{ margin: 0, color: '#0066cc' }}>
            <strong>Database Info:</strong> Using your actual booking data. Make sure you have:
          </p>
          <ul style={{ margin: 'var(--spacing-xs) 0', paddingLeft: 'var(--spacing-lg)' }}>
            <li>Completed bookings in the 'bookings' table</li>
            <li>Service information in the 'services' table</li>
            <li>Proper status fields and pricing data</li>
          </ul>
        </div>

        <div style={{ 
          marginBottom: 'var(--spacing-xl)', 
          display: 'flex', 
          gap: 'var(--spacing-md)', 
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <label htmlFor="report-type" style={{ fontFamily: 'var(--font-family-sans-serif)', fontWeight: 500 }}>Report Period:</label>
          <select
            id="report-type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'daily' | 'monthly' | 'yearly')}
            style={{ 
              padding: 'var(--spacing-xs)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 'var(--border-radius-sm)', 
              minWidth: '150px' 
            }}
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <Button variant="primary" onClick={handleGenerateReport} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
          {reportData && (
            <Button variant="secondary" onClick={handleExportCSV}>
              Export CSV
            </Button>
          )}
        </div>

        {error && (
          <div className="auth-error-message" style={{ marginBottom: 'var(--spacing-md)', whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}

        {reportData && (
          <div style={{ 
            backgroundColor: 'var(--color-background)', 
            padding: 'var(--spacing-lg)', 
            borderRadius: 'var(--border-radius-md)', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 'var(--spacing-lg)' 
            }}>
              <h3 style={{ 
                fontFamily: 'var(--font-family-serif)', 
                fontSize: '2rem', 
                margin: 0 
              }}>
                {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Performance Report
              </h3>
              <span style={{ 
                color: 'var(--color-text-light)', 
                fontSize: '0.9rem' 
              }}>
                {reportData.dateRange}
              </span>
            </div>

            {/* Key Metrics */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: 'var(--spacing-lg)', 
              marginBottom: 'var(--spacing-xl)' 
            }}>
              <div style={{ 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--border-radius-sm)', 
                padding: 'var(--spacing-md)', 
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--color-text-light)', margin: '0 0 var(--spacing-xs) 0' }}>Total Revenue</p>
                <p style={{ fontSize: '2.5rem', fontFamily: 'var(--font-family-serif)', color: 'var(--color-accent)', margin: 0 }}>
                  {formatCurrency(reportData.totalRevenue)}
                </p>
              </div>
              <div style={{ 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--border-radius-sm)', 
                padding: 'var(--spacing-md)', 
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--color-text-light)', margin: '0 0 var(--spacing-xs) 0' }}>Bookings Completed</p>
                <p style={{ fontSize: '2.5rem', fontFamily: 'var(--font-family-serif)', color: 'var(--color-primary-dark)', margin: 0 }}>
                  {reportData.bookingsCompleted}
                </p>
              </div>
              <div style={{ 
                border: '1px solid var(--color-border)', 
                borderRadius: 'var(--border-radius-sm)', 
                padding: 'var(--spacing-md)', 
                textAlign: 'center',
                backgroundColor: 'white'
              }}>
                <p style={{ fontSize: '1.2rem', color: 'var(--color-text-light)', margin: '0 0 var(--spacing-xs) 0' }}>Customers Served</p>
                <p style={{ fontSize: '2.5rem', fontFamily: 'var(--font-family-serif)', color: 'var(--color-primary-dark)', margin: 0 }}>
                  {reportData.customersServed}
                </p>
              </div>
            </div>

            {/* Revenue by Service */}
            {reportData.revenueByService.length > 0 && (
              <>
                <h4 style={{ 
                  fontFamily: 'var(--font-family-serif)', 
                  fontSize: '1.5rem', 
                  marginBottom: 'var(--spacing-md)',
                  borderBottom: '2px solid var(--color-border)',
                  paddingBottom: 'var(--spacing-xs)'
                }}>
                  Revenue by Service
                </h4>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 'var(--spacing-lg)' }}>
                  {reportData.revenueByService.map((item, index) => (
                    <li key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      padding: 'var(--spacing-sm) 0', 
                      borderBottom: '1px dashed var(--color-border)',
                      alignItems: 'center'
                    }}>
                      <span style={{ flex: 1 }}>{item.service}</span>
                      <span style={{ 
                        fontWeight: 'bold', 
                        color: 'var(--color-accent)',
                        minWidth: '100px',
                        textAlign: 'right'
                      }}>
                        {formatCurrency(item.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Popular Service */}
            <div style={{ 
              textAlign: 'center', 
              padding: 'var(--spacing-md)', 
              backgroundColor: 'var(--color-background-alt)',
              borderRadius: 'var(--border-radius-sm)',
              border: '1px solid var(--color-border)'
            }}>
              <p style={{ margin: 0, color: 'var(--color-text-light)' }}>
                Most Popular Service: <strong style={{ color: 'var(--color-primary-dark)' }}>{reportData.popularService.name}</strong> 
                {' '}({reportData.popularService.count} {reportData.popularService.count === 1 ? 'booking' : 'bookings'})
              </p>
            </div>

            {/* Report Summary */}
            <div style={{ 
              marginTop: 'var(--spacing-lg)', 
              padding: 'var(--spacing-md)', 
              backgroundColor: 'var(--color-background)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.9rem',
              color: 'var(--color-text-light)',
              textAlign: 'center'
            }}>
              Report generated on {new Date().toLocaleString()}
            </div>
          </div>
        )}

        {!reportData && !loading && (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-xl)', 
            color: 'var(--color-text-light)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--border-radius-md)'
          }}>
            <p>Select a report period and click "Generate Report" to view your business insights.</p>
            <p style={{ fontSize: '0.9rem', marginTop: 'var(--spacing-sm)' }}>
              The report will show completed bookings data from your database.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default GenerateReports;