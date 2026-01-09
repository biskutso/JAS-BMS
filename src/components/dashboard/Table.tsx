// src/components/dashboard/Table.tsx
import React, { useState, useMemo, useEffect } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  searchable?: boolean;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  searchFn?: (item: T, searchTerm: string) => boolean;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption?: string;
  emptyMessage?: string;
  className?: string;
  showSearch?: boolean;
  showPagination?: boolean;
  pageSizeOptions?: number[];
  onRowClick?: (item: T) => void;
  searchPlaceholder?: string;
}

const Table = <T extends Record<string, any>>({ 
  data, 
  columns, 
  caption,
  emptyMessage = "No data to display.",
  className = "",
  showSearch = true,
  showPagination = true,
  pageSizeOptions = [5, 10, 25, 50],
  onRowClick,
  searchPlaceholder = "Search..."
}: TableProps<T>): React.ReactElement => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Helper function to extract text from React nodes for searching
  const extractTextFromReactNode = (node: React.ReactNode): string => {
    if (node == null) return '';
    
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (typeof node === 'boolean') return '';
    
    if (Array.isArray(node)) {
      return node.map(child => extractTextFromReactNode(child)).join(' ');
    }
    
    if (React.isValidElement(node)) {
      const children = node.props.children;
      if (children) {
        return extractTextFromReactNode(children);
      }
      return '';
    }
    
    return String(node);
  };

  // Universal function to get raw value for sorting
  const getRawValue = (item: T, columnKey: string): any => {
    const column = columns.find(col => col.key === columnKey);
    
    // If column has a custom render function and no custom sort function,
    // we need to extract the raw data intelligently
    if (column?.render && !column.sortFn) {
      // Try to guess what the render function is displaying
      // This is a fallback - custom sort functions are preferred
      
      // Common patterns for booking tables
      if (columnKey === 'service') {
        return item.service_name || item.serviceName || item.name || '';
      }
      if (columnKey === 'customer') {
        return item.customer_name || item.customerName || item.customer || '';
      }
      if (columnKey === 'staff') {
        return item.staff_name || item.staffName || item.staff || '';
      }
      if (columnKey === 'datetime' || columnKey === 'date' || columnKey === 'time') {
        return item.booking_date || item.date || item.created_at || '';
      }
      if (columnKey === 'status') {
        return item.status || '';
      }
      if (columnKey === 'price' || columnKey === 'amount') {
        return item.price || item.amount || item.total || 0;
      }
    }
    
    // Handle nested properties
    if (columnKey.includes('.')) {
      const keys = columnKey.split('.');
      let value = item;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return '';
        }
      }
      return value;
    }
    
    // Direct property access
    return item[columnKey];
  };

  // Function to get searchable text from a column
  const getSearchableText = (item: T, columnKey: string): string => {
    const column = columns.find(col => col.key === columnKey);
    
    if (!column) return '';
    
    // If column has a custom render function, extract text from it
    if (column.render) {
      const rendered = column.render(item);
      return extractTextFromReactNode(rendered);
    }
    
    // Otherwise, get the raw value
    const rawValue = getRawValue(item, columnKey);
    return rawValue != null ? String(rawValue) : '';
  };

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;

    const lowercasedSearch = searchTerm.toLowerCase().trim();
    
    return data.filter(item => {
      // Check if any searchable column contains the search term
      return columns.some(col => {
        // Skip if column is explicitly not searchable
        if (col.searchable === false) return false;
        
        // Use custom search function if provided
        if (col.searchFn) {
          return col.searchFn(item, lowercasedSearch);
        }
        
        // Get searchable text for this column
        const searchableText = getSearchableText(item, col.key as string).toLowerCase();
        
        // Check if the searchable text contains the search term
        return searchableText.includes(lowercasedSearch);
      });
    });
  }, [data, searchTerm, columns]);

  // Sort data with intelligent default sorting
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const column = columns.find(col => col.key === sortConfig.key);
      
      // Use custom sort function if provided
      if (column?.sortFn) {
        const comparison = column.sortFn(a, b);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      const aValue = getRawValue(a, sortConfig.key);
      const bValue = getRawValue(b, sortConfig.key);
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
      if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      
      // SPECIAL CASE: Status sorting with custom order
      if (sortConfig.key === 'status' || sortConfig.key.toLowerCase().includes('status')) {
        const statusOrder = {
          'pending': 0,
          'confirmed': 1,
          'completed': 2,
          'cancelled': 3,
          'canceled': 3,
          'active': 0,
          'inactive': 1,
          'enabled': 0,
          'disabled': 1,
          'published': 0,
          'draft': 1,
          'archived': 2
        };
        
        const aStatus = String(aValue).toLowerCase();
        const bStatus = String(bValue).toLowerCase();
        
        const aOrder = statusOrder[aStatus as keyof typeof statusOrder] ?? 999;
        const bOrder = statusOrder[bStatus as keyof typeof statusOrder] ?? 999;
        
        const comparison = aOrder - bOrder;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      // SPECIAL CASE: Date sorting
      if (sortConfig.key.includes('date') || sortConfig.key.includes('time') || 
          sortConfig.key.includes('created') || sortConfig.key.includes('updated')) {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        
        if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          const comparison = dateA.getTime() - dateB.getTime();
          return sortConfig.direction === 'asc' ? comparison : -comparison;
        }
      }
      
      // SPECIAL CASE: Currency/price sorting
      if (sortConfig.key.includes('price') || sortConfig.key.includes('amount') || 
          sortConfig.key.includes('total') || sortConfig.key.includes('cost')) {
        // Extract numbers from strings like "$150.00" or "P150.00 • 75min"
        const extractNumber = (value: any): number => {
          if (typeof value === 'number') return value;
          if (typeof value === 'string') {
            const match = value.match(/(\d+(\.\d+)?)/);
            return match ? parseFloat(match[1]) : 0;
          }
          return 0;
        };
        
        const aNum = extractNumber(aValue);
        const bNum = extractNumber(bValue);
        const comparison = aNum - bNum;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }
      
      let comparison = 0;
      
      // Check if values are numbers
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      const isANumber = !isNaN(aNum);
      const isBNumber = !isNaN(bNum);
      
      // Sort by numbers if both are numbers
      if (isANumber && isBNumber) {
        comparison = aNum - bNum;
      }
      // Sort by string (case insensitive)
      else {
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        comparison = aStr.localeCompare(bStr);
      }
      
      // Reverse if descending
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startRow = (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, sortedData.length);
  const totalRows = sortedData.length;

  // Handle sort
  const handleSort = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (column?.sortable === false) return;
    
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (!data || data.length === 0) {
    return (
      <div className="dashboard-empty-table-message">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="dashboard-table-container">
      {/* Table Controls */}
      <div className="dashboard-table-controls">
        {/* Search Input */}
        {showSearch && (
          <div className="dashboard-table-search">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dashboard-search-input"
            />
            {searchTerm && (
              <button 
                className="dashboard-search-clear"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
            <span className="dashboard-search-icon">🔍</span>
          </div>
        )}

        {/* Page Size Selector */}
        {showPagination && (
          <div className="dashboard-page-size-selector">
            <label htmlFor="pageSize">Show:</label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="dashboard-page-size-select"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="dashboard-page-size-label">entries</span>
          </div>
        )}
      </div>

      {/* Info Summary */}
      <div className="dashboard-table-info">
        Showing {startRow} to {endRow} of {totalRows} entries
        {searchTerm && (
          <span className="dashboard-search-info">
            (filtered from {data.length} total entries)
          </span>
        )}
      </div>

      {/* Table */}
      <div className="dashboard-table-wrapper">
        <table className={`dashboard-table ${className}`}>
          {caption && <caption className="dashboard-table-caption">{caption}</caption>}
          <thead className="dashboard-table-header">
            <tr>
              {/* Row Number Column */}
              <th className="dashboard-row-number" key="row-number">#</th>
              
              {columns.map((col, index) => {
                // Don't make actions column sortable by default
                const isActionsColumn = col.key === 'actions' || 
                                       col.header.toLowerCase().includes('action') ||
                                       col.header.toLowerCase().includes('options');
                const isSortable = col.sortable !== false && !isActionsColumn;
                
                return (
                  <th 
                    key={`${String(col.key)}-${index}`}
                    onClick={() => isSortable && handleSort(col.key as string)}
                    className={isSortable ? 'dashboard-sortable-header' : ''}
                    style={{ 
                      cursor: isSortable ? 'pointer' : 'default',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <div className="dashboard-header-content">
                      {col.header}
                      {isSortable && sortConfig?.key === col.key && (
                        <span className="dashboard-sort-indicator">
                          {sortConfig.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="dashboard-table-body">
            {paginatedData.map((item, rowIndex) => (
              <tr 
                key={item.id || item._id || rowIndex}
                onClick={() => onRowClick && onRowClick(item)}
                className={onRowClick ? 'dashboard-clickable-row' : ''}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              >
                {/* Row Number */}
                <td className="dashboard-row-number">
                  {startRow + rowIndex}
                </td>
                
                {/* Data Columns */}
                {columns.map((col, colIndex) => {
                  const cellContent = col.render ? 
                    col.render(item) : 
                    (getRawValue(item, col.key as string) as React.ReactNode);
                  
                  return (
                    <td 
                      key={`${String(col.key)}-${colIndex}-${rowIndex}`}
                      data-label={col.header}
                      className={
                        col.key === 'actions' || 
                        col.header.toLowerCase().includes('action') ? 
                        'actions-column' : ''
                      }
                    >
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="dashboard-pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="dashboard-pagination-btn dashboard-pagination-prev"
          >
            ← Previous
          </button>
          
          <div className="dashboard-pagination-pages">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`dashboard-pagination-btn ${currentPage === pageNum ? 'dashboard-pagination-active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="dashboard-pagination-ellipsis">...</span>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  className="dashboard-pagination-btn"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="dashboard-pagination-btn dashboard-pagination-next"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default Table;