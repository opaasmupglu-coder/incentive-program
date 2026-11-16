export function downloadCsv(
  filename: string,
  rows: (string | number | null)[][],
) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          let s = value === null ? "" : String(value);
          if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
          return '"' + s.replace(/"/g, '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
