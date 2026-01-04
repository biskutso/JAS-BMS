// src/components/dashboard/Table.tsx
import React from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption?: string;
  emptyMessage?: string;
  className?: string;
}

const Table = <T extends Record<string, any>>({ 
  data, 
  columns, 
  caption,
  emptyMessage = "No data to display.",
  className = ""
}: TableProps<T>): React.ReactElement => {
  if (!data || data.length === 0) {
    return (
      <div className="dashboard-empty-table-message">
        {emptyMessage}
      </div>
    );
  }

  return (
    <table className={`dashboard-table ${className}`}>
      {caption && <caption className="dashboard-table-caption">{caption}</caption>}
      <thead className="dashboard-table-header">
        <tr>
          {columns.map((col, index) => (
            <th key={index}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="dashboard-table-body">
        {data.map((item, rowIndex) => (
          <tr key={item.id || rowIndex}>
            {columns.map((col, colIndex) => (
              <td 
                key={colIndex} 
                data-label={col.header}
              >
                {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Table;