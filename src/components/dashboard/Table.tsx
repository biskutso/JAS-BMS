// src/components/dashboard/Table.tsx
import React from 'react';

interface Column<T> {
  key: keyof T | string; // keyof T for type safety, string for nested or computed keys
  header: string;
  render?: (item: T) => React.ReactNode; // Optional custom renderer
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  caption?: string; // For accessibility
  emptyMessage?: string; // Custom message when no data
}

const Table = <T extends Record<string, any>>({ 
  data, 
  columns, 
  caption,
  emptyMessage = "No data to display." 
}: TableProps<T>): React.ReactElement => {
  if (!data || data.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        marginTop: 'var(--spacing-lg)',
        padding: '40px',
        color: '#666'
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <table className="data-table">
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          {columns.map((col, index) => (
            <th key={index}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, rowIndex) => (
          <tr key={item.id || rowIndex}>
            {columns.map((col, colIndex) => (
              <td key={colIndex} data-label={col.header}>
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