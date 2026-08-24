// xlsx is loaded on demand so it never weighs down the initial page load
export const exportToExcel = async (data, columns, filename) => {
  const XLSX = await import('xlsx');

  const rows = data.map((row) => {
    const obj = {};
    columns.forEach((col) => {
      obj[col.header] = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  worksheet['!cols'] = columns.map((col) => ({
    wch: Math.max(col.header.length, 12),
  }));

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};
