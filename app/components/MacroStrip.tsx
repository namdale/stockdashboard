"use client";

import { useEffect, useState } from "react";

interface Series {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  asOf: string | null;
  source: string;
  url: string;
}

export function MacroStrip() {
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    fetch("/api/macro")
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.series || []);
      })
      .catch(() => {});
  }, []);

  if (!series.length) return <div className="macro-strip" />;

  return (
    <div className="macro-strip">
      {series.map((s) =>
        s.url ? (
          <a
            className="macro-cell macro-link"
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${s.label} 원본 데이터 보기`}
          >
            <div className="macro-label">
              {s.label}
              {s.source.startsWith("demo") && <span className="badge-demo">demo</span>}
            </div>
            <div className="macro-value">
              {s.value != null ? `${s.unit}${s.value.toLocaleString()}` : "—"}
            </div>
            <div className="macro-asof">
              {s.asOf || "—"} · {s.source}
            </div>
          </a>
        ) : (
          <div className="macro-cell" key={s.id}>
            <div className="macro-label">
              {s.label}
              {s.source.startsWith("demo") && <span className="badge-demo">demo</span>}
            </div>
            <div className="macro-value">
              {s.value != null ? `${s.unit}${s.value.toLocaleString()}` : "—"}
            </div>
            <div className="macro-asof">
              {s.asOf || "—"} · {s.source}
            </div>
          </div>
        )
      )}
    </div>
  );
}
