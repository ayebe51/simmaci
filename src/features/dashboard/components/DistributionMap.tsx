import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, DistributionMapData, DistrictStat, DistrictSchool } from '@/services/dashboardApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Download, 
  School, 
  Users, 
  GraduationCap, 
  Layers, 
  Search, 
  X, 
  Info, 
  Sparkles, 
  RefreshCw,
  Building2,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';

// GeoJSON coordinate bounds for Cilacap
const GEO_BOUNDS = {
  minLng: 108.5559,
  maxLng: 109.3955,
  minLat: -7.7849,
  maxLat: -7.1387,
};

const SVG_WIDTH = 920;
const SVG_HEIGHT = 680;
const PADDING = 36;
const COS_LAT = Math.cos(-7.46 * (Math.PI / 180));
const GEO_W = (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng) * COS_LAT;
const GEO_H = GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat;
const SCALE = Math.min((SVG_WIDTH - PADDING * 2) / GEO_W, (SVG_HEIGHT - PADDING * 2) / GEO_H);

function project(lng: number, lat: number): [number, number] {
  const x = PADDING + (lng - GEO_BOUNDS.minLng) * COS_LAT * SCALE;
  const y = SVG_HEIGHT - PADDING - (lat - GEO_BOUNDS.minLat) * SCALE;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function coordsToSvgPath(coords: any, type: string): string {
  if (type === 'Polygon') {
    return coords.map((ring: number[][]) => {
      return ring.map((pt, i) => {
        const [x, y] = project(pt[0], pt[1]);
        return (i === 0 ? 'M' : 'L') + x + ',' + y;
      }).join(' ') + ' Z';
    }).join(' ');
  } else if (type === 'MultiPolygon') {
    return coords.map((poly: number[][][]) => {
      return poly.map((ring: number[][]) => {
        return ring.map((pt, i) => {
          const [x, y] = project(pt[0], pt[1]);
          return (i === 0 ? 'M' : 'L') + x + ',' + y;
        }).join(' ') + ' Z';
      }).join(' ');
    }).join(' ');
  }
  return '';
}

export type MapMetric = 'schools' | 'ptk' | 'students';

interface GeoFeature {
  type: string;
  id: string;
  properties: {
    kode: string;
    nama: string;
    center: [number, number];
  };
  geometry: {
    type: string;
    coordinates: any;
  };
  svgPath?: string;
  projectedCenter?: [number, number];
}

export function DistributionMap() {
  const [metric, setMetric] = useState<MapMetric>('schools');
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [searchSchool, setSearchSchool] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // 1. Fetch Aggregation Data from Backend
  const { data: apiData, isLoading: isLoadingStats, refetch } = useQuery({
    queryKey: ['distribution-map-data'],
    queryFn: () => dashboardApi.getDistributionMap(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // 2. Fetch GeoJSON Boundaries of Cilacap
  useEffect(() => {
    fetch('/data/cilacap-kecamatan.geojson')
      .then((res) => res.json())
      .then((geojson) => {
        if (geojson && geojson.features) {
          const processed = geojson.features.map((f: any) => ({
            ...f,
            svgPath: coordsToSvgPath(f.geometry.coordinates, f.geometry.type),
            projectedCenter: project(f.properties.center[0], f.properties.center[1]),
          }));
          setGeoFeatures(processed);
        }
      })
      .catch((err) => {
        console.error('Failed to load Cilacap GeoJSON:', err);
      });
  }, []);

  // Map districts by lowercase name for fast lookup
  const districtStatsMap = useMemo(() => {
    const map = new Map<string, DistrictStat>();
    if (apiData?.districts) {
      apiData.districts.forEach((d) => {
        map.set(d.nama.toLowerCase().trim(), d);
      });
    }
    return map;
  }, [apiData]);

  // Determine min and max values for choropleth scale
  const { maxVal, totalVal } = useMemo(() => {
    let max = 1;
    let sum = 0;
    if (apiData?.districts) {
      apiData.districts.forEach((d) => {
        const val =
          metric === 'schools'
            ? d.schools_count
            : metric === 'ptk'
            ? d.teachers_count + d.tendiks_count
            : d.students_count;
        if (val > max) max = val;
        sum += val;
      });
    }
    return { maxVal: max, totalVal: sum };
  }, [apiData, metric]);

  // Color generator based on metric & value
  const getColor = (val: number, isHovered: boolean, isSelected: boolean) => {
    if (val === 0) {
      if (isSelected) return '#38bdf8';
      if (isHovered) return '#cbd5e1';
      return '#f1f5f9'; // Slate 100
    }

    const ratio = Math.min(1, Math.max(0.15, val / maxVal));

    if (metric === 'schools') {
      // Emerald / Green Palette (LP Ma'arif brand)
      if (isSelected) return '#f59e0b'; // Amber highlight
      if (isHovered) return '#059669';
      if (ratio < 0.25) return '#a7f3d0'; // emerald-200
      if (ratio < 0.5) return '#34d399';  // emerald-400
      if (ratio < 0.75) return '#10b981'; // emerald-500
      return '#047857';                  // emerald-700
    } else if (metric === 'ptk') {
      // Teal / Cyan Palette
      if (isSelected) return '#f59e0b';
      if (isHovered) return '#0d9488';
      if (ratio < 0.25) return '#99f6e4'; // teal-200
      if (ratio < 0.5) return '#2dd4bf';  // teal-400
      if (ratio < 0.75) return '#14b8a6'; // teal-500
      return '#0f766e';                  // teal-700
    } else {
      // Indigo / Blue Palette (Siswa)
      if (isSelected) return '#f59e0b';
      if (isHovered) return '#2563eb';
      if (ratio < 0.25) return '#bfdbfe'; // blue-200
      if (ratio < 0.5) return '#60a5fa';  // blue-400
      if (ratio < 0.75) return '#3b82f6'; // blue-500
      return '#1d4ed8';                  // blue-700
    }
  };

  const getDistrictValue = (dName: string) => {
    const stat = districtStatsMap.get(dName.toLowerCase().trim());
    if (!stat) return 0;
    if (metric === 'schools') return stat.schools_count;
    if (metric === 'ptk') return stat.teachers_count + stat.tendiks_count;
    return stat.students_count;
  };

  const activeDistrictData = useMemo(() => {
    if (!selectedDistrict) return null;
    return districtStatsMap.get(selectedDistrict.toLowerCase().trim()) || null;
  }, [selectedDistrict, districtStatsMap]);

  const hoveredDistrictData = useMemo(() => {
    if (!hoveredDistrict) return null;
    return districtStatsMap.get(hoveredDistrict.toLowerCase().trim()) || null;
  }, [hoveredDistrict, districtStatsMap]);

  // Filtered schools in the selected district drill-down
  const filteredSchools = useMemo(() => {
    if (!activeDistrictData) return [];
    if (!searchSchool.trim()) return activeDistrictData.schools;
    const q = searchSchool.toLowerCase();
    return activeDistrictData.schools.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) ||
        (s.npsn && s.npsn.includes(q)) ||
        (s.jenjang && s.jenjang.toLowerCase().includes(q))
    );
  }, [activeDistrictData, searchSchool]);

  // 3. HD PNG Export Functionality
  const handleExportHdPng = async () => {
    try {
      setIsExporting(true);
      toast.info('Menyiapkan gambar resolusi tinggi (HD)...');

      const width = 2760;
      const height = 2040;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');

      // High-res Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Top Decorative Accent Bar
      const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
      topBarGrad.addColorStop(0, '#047857'); // Emerald-700
      topBarGrad.addColorStop(0.5, '#10b981'); // Emerald-500
      topBarGrad.addColorStop(1, '#0f766e'); // Teal-700
      ctx.fillStyle = topBarGrad;
      ctx.fillRect(0, 0, width, 24);

      // Header Banner Box
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 15;
      ctx.beginPath();
      ctx.roundRect(80, 60, width - 160, 180, 32);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Header Texts
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      ctx.fillText("PETA SEBARAN MADRASAH & PTK LP MA'ARIF NU", 120, 130);

      ctx.fillStyle = '#475569';
      ctx.font = '600 28px system-ui, -apple-system, sans-serif';
      const metricLabel =
        metric === 'schools'
          ? 'Sebaran Satuan Pendidikan (RA / MI / MTs / MA)'
          : metric === 'ptk'
          ? 'Sebaran Pendidik & Tenaga Kependidikan (Guru & Tendik)'
          : 'Sebaran Peserta Didik (Data Berjalan)';
      ctx.fillText(`KABUPATEN CILACAP • ${metricLabel.toUpperCase()}`, 120, 175);

      // Timestamp Badge
      const nowStr = new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Tanggal Cetak: ${nowStr} • SIMMACI Official GIS`, 120, 210);

      // Draw Summary Statistics Card in Header (Right Side)
      const summary = apiData?.summary || {
        total_schools: 0,
        total_teachers: 0,
        total_tendiks: 0,
        total_students: 0,
      };

      const statBoxX = width - 820;
      ctx.fillStyle = '#f0fdf4';
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(statBoxX, 85, 700, 130, 20);
      ctx.fill();
      ctx.stroke();

      const kpiItems = [
        { label: 'MADRASAH', val: summary.total_schools },
        { label: 'GURU', val: summary.total_teachers },
        { label: 'TENDIK', val: summary.total_tendiks },
        { label: 'SISWA', val: summary.total_students },
      ];

      kpiItems.forEach((kpi, idx) => {
        const itemX = statBoxX + 35 + idx * 165;
        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
        ctx.fillText(String(kpi.val), itemX, 140);
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
        ctx.fillText(kpi.label, itemX, 175);
      });

      // Canvas Map Projection Scaler (3x scale)
      const mapOffsetX = 120;
      const mapOffsetY = 280;
      const mapScale = 2.75;

      const projectCanvas = (lng: number, lat: number): [number, number] => {
        const [x, y] = project(lng, lat);
        return [mapOffsetX + x * mapScale, mapOffsetY + y * mapScale];
      };

      // Draw Polygons onto Canvas
      geoFeatures.forEach((feat) => {
        const dName = feat.properties.nama;
        const val = getDistrictValue(dName);
        const fillCol = getColor(val, false, feat.properties.nama === selectedDistrict);

        ctx.fillStyle = fillCol;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';

        const drawRing = (ring: number[][]) => {
          ctx.beginPath();
          ring.forEach((pt, i) => {
            const [cx, cy] = projectCanvas(pt[0], pt[1]);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        if (feat.geometry.type === 'Polygon') {
          feat.geometry.coordinates.forEach((ring: number[][]) => drawRing(ring));
        } else if (feat.geometry.type === 'MultiPolygon') {
          feat.geometry.coordinates.forEach((poly: number[][][]) => {
            poly.forEach((ring: number[][]) => drawRing(ring));
          });
        }

        // Draw District Labels & Counts
        const center = feat.properties.center;
        if (center) {
          const [cx, cy] = projectCanvas(center[0], center[1]);

          // Small white badge pill
          const labelText = dName;
          const countText = `${val} ${metric === 'schools' ? 'Lembaga' : metric === 'ptk' ? 'PTK' : 'Siswa'}`;

          ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
          const tw1 = ctx.measureText(labelText).width;
          ctx.font = '18px system-ui, -apple-system, sans-serif';
          const tw2 = ctx.measureText(countText).width;
          const boxW = Math.max(tw1, tw2) + 24;
          const boxH = 46;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 10);
          ctx.fill();
          ctx.shadowColor = 'transparent';

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(labelText, cx, cy - 3);

          ctx.fillStyle = '#047857';
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
          ctx.fillText(countText, cx, cy + 16);
          ctx.textAlign = 'start';
        }
      });

      // Bottom Legend Card
      const legendX = 80;
      const legendY = height - 170;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.roundRect(legendX, legendY, 680, 100, 20);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText('LEGENDA KEPADATAN SEBARAN', legendX + 24, legendY + 36);

      const legendSteps = [
        { label: '0', color: '#f1f5f9' },
        { label: 'Rendah', color: metric === 'schools' ? '#a7f3d0' : metric === 'ptk' ? '#99f6e4' : '#bfdbfe' },
        { label: 'Sedang', color: metric === 'schools' ? '#34d399' : metric === 'ptk' ? '#2dd4bf' : '#60a5fa' },
        { label: 'Tinggi', color: metric === 'schools' ? '#10b981' : metric === 'ptk' ? '#14b8a6' : '#3b82f6' },
        { label: 'Sangat Tinggi', color: metric === 'schools' ? '#047857' : metric === 'ptk' ? '#0f766e' : '#1d4ed8' },
      ];

      legendSteps.forEach((st, idx) => {
        const swX = legendX + 24 + idx * 128;
        const swY = legendY + 52;
        ctx.fillStyle = st.color;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(swX, swY, 28, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '600 16px system-ui, -apple-system, sans-serif';
        ctx.fillText(st.label, swX + 36, swY + 17);
      });

      // Footer Watermark
      ctx.fillStyle = '#64748b';
      ctx.font = '500 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        "© SIMMACI • Sistem Informasi Manajemen LP Ma'arif NU Kabupaten Cilacap",
        width - 80,
        height - 60
      );

      // Trigger download
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(blob, `peta-sebaran-maarif-cilacap-${metric}-hd.png`);
          toast.success('Peta resolusi tinggi (HD) berhasil diunduh!');
        } else {
          toast.error('Gagal membuat file gambar');
        }
        setIsExporting(false);
      }, 'image/png');
    } catch (err: any) {
      console.error('HD Export Error:', err);
      toast.error('Gagal mengunduh peta: ' + (err.message || 'Error'));
      setIsExporting(false);
    }
  };

  const summary = apiData?.summary || {
    total_schools: 0,
    total_teachers: 0,
    total_tendiks: 0,
    total_students: 0,
    total_districts_covered: 0,
    total_districts: 24,
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Madrasah */}
        <Card className="rounded-2xl border border-slate-200/90 shadow-sm bg-gradient-to-br from-white to-emerald-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Total Madrasah
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
              <School className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.total_schools}</p>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            Tersebar di {summary.total_districts_covered} dari 24 Kecamatan
          </p>
        </Card>

        {/* Total Guru */}
        <Card className="rounded-2xl border border-slate-200/90 shadow-sm bg-gradient-to-br from-white to-teal-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Total Guru
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-100/70 text-teal-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.total_teachers}</p>
          <p className="text-[10px] text-teal-700 font-semibold mt-0.5">
            Pendidik Aktif (GTY, GTT, PNS)
          </p>
        </Card>

        {/* Total Tendik */}
        <Card className="rounded-2xl border border-slate-200/90 shadow-sm bg-gradient-to-br from-white to-amber-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Tenaga Kependidikan
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100/70 text-amber-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{summary.total_tendiks}</p>
          <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
            Staff & Tenaga Administrasi
          </p>
        </Card>

        {/* Total Siswa (Data Berjalan) */}
        <Card className="rounded-2xl border border-slate-200/90 shadow-sm bg-gradient-to-br from-white to-blue-50/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              Siswa Terdata
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-black text-slate-900">{summary.total_students}</p>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[9px] font-bold py-0 px-1.5">
              Data Berjalan
            </Badge>
          </div>
          <p className="text-[10px] text-blue-700 font-semibold mt-0.5">
            Sinkronisasi PPDB & Emis
          </p>
        </Card>
      </div>

      {/* 2. MAIN MAP CONTAINER */}
      <Card className="rounded-3xl border border-slate-200/90 shadow-md bg-white overflow-hidden">
        {/* Header with Title & Controls */}
        <CardHeader className="p-5 sm:p-6 border-b bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <CardTitle className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Peta Sebaran Madrasah & Wilayah</span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                  24 Kecamatan Asli Cilacap
                </Badge>
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Visualisasi poligon resmi Kabupaten Cilacap. Arahkan kursor atau klik kecamatan untuk rincian madrasah.
            </CardDescription>
          </div>

          {/* Action Buttons: Metric Switcher & HD Download */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Metric Pills */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                onClick={() => setMetric('schools')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  metric === 'schools'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Madrasah
              </button>
              <button
                onClick={() => setMetric('ptk')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  metric === 'ptk'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Guru & Tendik
              </button>
              <button
                onClick={() => setMetric('students')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${
                  metric === 'students'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Siswa</span>
                <span className="text-[9px] px-1 py-0.2 bg-white/20 rounded font-normal">Parsial</span>
              </button>
            </div>

            {/* HD PNG Download Button */}
            <Button
              onClick={handleExportHdPng}
              disabled={isExporting || geoFeatures.length === 0}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold h-9 px-4 shadow-sm flex items-center gap-2 transition-all hover:scale-105"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Memproses...' : 'Unduh Peta HD (PNG)'}</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
            {/* Map Canvas Area (col-span-8) */}
            <div className="lg:col-span-8 relative bg-slate-50/70 p-4 sm:p-6 flex flex-col items-center justify-center overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200/80">
              {geoFeatures.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-24 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Memuat Peta Poligon Kabupaten Cilacap...
                  </span>
                </div>
              ) : (
                <div className="relative w-full max-w-[860px] aspect-[920/680] flex items-center justify-center">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                    className="w-full h-full select-none filter drop-shadow-sm"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMousePos({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }}
                    onMouseLeave={() => {
                      setHoveredDistrict(null);
                      setMousePos(null);
                    }}
                  >
                    {/* Background ocean/sea subtle contour */}
                    <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#f8fafc" rx="20" />

                    {/* Districts Polygons */}
                    {geoFeatures.map((feat) => {
                      const dName = feat.properties.nama;
                      const val = getDistrictValue(dName);
                      const isHovered = hoveredDistrict === dName;
                      const isSelected = selectedDistrict === dName;
                      const fillColor = getColor(val, isHovered, isSelected);

                      return (
                        <g key={feat.id || dName} className="cursor-pointer transition-all duration-200">
                          <path
                            d={feat.svgPath}
                            fill={fillColor}
                            stroke={isSelected ? '#b45309' : isHovered ? '#0f172a' : '#ffffff'}
                            strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.2}
                            strokeLinejoin="round"
                            className="transition-all duration-150"
                            style={{
                              filter: isHovered || isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none',
                            }}
                            onMouseEnter={() => setHoveredDistrict(dName)}
                            onClick={() => {
                              setSelectedDistrict(selectedDistrict === dName ? null : dName);
                            }}
                          />
                        </g>
                      );
                    })}

                    {/* Labels & Centroid Dots */}
                    {geoFeatures.map((feat) => {
                      const dName = feat.properties.nama;
                      const center = feat.projectedCenter;
                      if (!center) return null;
                      const val = getDistrictValue(dName);
                      const isHovered = hoveredDistrict === dName;
                      const isSelected = selectedDistrict === dName;

                      return (
                        <g
                          key={`label-${feat.id || dName}`}
                          className="pointer-events-none select-none transition-all"
                        >
                          {/* Centroid small circle */}
                          <circle
                            cx={center[0]}
                            cy={center[1]}
                            r={isHovered || isSelected ? 4 : 2.5}
                            fill={isSelected ? '#f59e0b' : isHovered ? '#047857' : '#334155'}
                            stroke="#ffffff"
                            strokeWidth="1"
                          />

                          {/* District Name Label */}
                          <text
                            x={center[0]}
                            y={center[1] - 8}
                            textAnchor="middle"
                            className="text-[11px] font-extrabold fill-slate-800 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
                            style={{
                              fontSize: isHovered || isSelected ? '12px' : '10px',
                              fontWeight: isHovered || isSelected ? '900' : '700',
                            }}
                          >
                            {dName}
                          </text>

                          {/* Count Badge under label */}
                          <text
                            x={center[0]}
                            y={center[1] + 13}
                            textAnchor="middle"
                            className="text-[9px] font-black fill-emerald-800 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]"
                          >
                            {val}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Floating Tooltip Hover */}
                  {hoveredDistrict && hoveredDistrictData && mousePos && (
                    <div
                      className="absolute z-20 pointer-events-none bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl backdrop-blur-md border border-slate-700/80 min-w-[210px] transform -translate-x-1/2 -translate-y-full"
                      style={{
                        left: Math.min(Math.max(mousePos.x, 110), 750),
                        top: Math.max(mousePos.y - 12, 10),
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                        <span className="text-xs font-black text-emerald-400">
                          Kecamatan {hoveredDistrictData.nama}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {hoveredDistrictData.kode}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Madrasah:</span>
                          <span className="font-extrabold text-white">
                            {hoveredDistrictData.schools_count} Satpen
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Guru:</span>
                          <span className="font-extrabold text-white">
                            {hoveredDistrictData.teachers_count} Orang
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Tendik:</span>
                          <span className="font-extrabold text-white">
                            {hoveredDistrictData.tendiks_count} Orang
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Siswa (Parsial):</span>
                          <span className="font-extrabold text-blue-400">
                            {hoveredDistrictData.students_count} Siswa
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-700/70 flex items-center justify-between text-[10px] text-emerald-300 font-semibold">
                        <span>Klik untuk lihat daftar sekolah</span>
                        <span>➔</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Legend Bar at Bottom Left */}
              <div className="w-full mt-4 flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-200/70 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Intensitas:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-200 inline-block border border-slate-300" />
                    <span className="text-[10px] text-slate-500">0</span>
                    <span
                      className={`w-3 h-3 rounded inline-block ${
                        metric === 'schools' ? 'bg-emerald-200' : metric === 'ptk' ? 'bg-teal-200' : 'bg-blue-200'
                      }`}
                    />
                    <span
                      className={`w-3 h-3 rounded inline-block ${
                        metric === 'schools' ? 'bg-emerald-400' : metric === 'ptk' ? 'bg-teal-400' : 'bg-blue-400'
                      }`}
                    />
                    <span
                      className={`w-3 h-3 rounded inline-block ${
                        metric === 'schools' ? 'bg-emerald-600' : metric === 'ptk' ? 'bg-teal-600' : 'bg-blue-600'
                      }`}
                    />
                    <span
                      className={`w-3 h-3 rounded inline-block ${
                        metric === 'schools' ? 'bg-emerald-800' : metric === 'ptk' ? 'bg-teal-800' : 'bg-blue-800'
                      }`}
                    />
                    <span className="text-[10px] text-slate-500">Maks ({maxVal})</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-medium">
                  {selectedDistrict ? (
                    <span className="text-emerald-700 font-bold">
                      Kecamatan Terpilih: <b>{selectedDistrict}</b> (Klik untuk batalkan)
                    </span>
                  ) : (
                    'Klik poligon wilayah untuk membuka rincian madrasah'
                  )}
                </div>
              </div>
            </div>

            {/* Drill-down Sidebar Area (col-span-4) */}
            <div className="lg:col-span-4 p-5 sm:p-6 bg-white flex flex-col justify-between">
              {activeDistrictData ? (
                <div className="space-y-4">
                  {/* Selected District Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-600 text-white font-extrabold text-[10px]">
                          Kecamatan
                        </Badge>
                        <span className="text-xs text-slate-400 font-mono">{activeDistrictData.kode}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mt-1">
                        {activeDistrictData.nama}
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDistrict(null)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Quick Stat Tiles */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-50/70 border border-emerald-100/80 p-2.5 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase">Sekolah</p>
                      <p className="text-lg font-black text-emerald-900 mt-0.5">
                        {activeDistrictData.schools_count}
                      </p>
                    </div>
                    <div className="bg-teal-50/70 border border-teal-100/80 p-2.5 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-teal-800 uppercase">Guru</p>
                      <p className="text-lg font-black text-teal-900 mt-0.5">
                        {activeDistrictData.teachers_count}
                      </p>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-100/80 p-2.5 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-amber-800 uppercase">Tendik</p>
                      <p className="text-lg font-black text-amber-900 mt-0.5">
                        {activeDistrictData.tendiks_count}
                      </p>
                    </div>
                  </div>

                  {/* Jenjang Breakdown Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Komposisi Jenjang:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Object.entries(activeDistrictData.jenjang_breakdown || {}).map(([jj, count]) => {
                        if (count === 0) return null;
                        return (
                          <Badge
                            key={jj}
                            variant="outline"
                            className="text-[10px] font-bold bg-slate-50 border-slate-200 text-slate-700"
                          >
                            {jj}: <b className="ml-1 text-slate-900">{count}</b>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Search within District */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                      placeholder="Cari madrasah..."
                      value={searchSchool}
                      onChange={(e) => setSearchSchool(e.target.value)}
                      className="pl-8 h-8 text-xs rounded-xl"
                    />
                  </div>

                  {/* List of Schools */}
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredSchools.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        {searchSchool ? 'Tidak ada madrasah cocok' : 'Belum ada madrasah terdata'}
                      </p>
                    ) : (
                      filteredSchools.map((sch) => (
                        <div
                          key={sch.id}
                          className="p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 leading-snug">
                              {sch.nama}
                            </span>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] font-extrabold shrink-0">
                              {sch.jenjang}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-50">
                            <span>
                              👨‍🏫 <b>{sch.teachers_count}</b> Guru • <b>{sch.tendiks_count}</b> Tendik
                            </span>
                            {sch.students_count > 0 && (
                              <span className="text-blue-600 font-bold">
                                🎓 {sch.students_count} Siswa
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Default Sidebar: Ranking / Overview of 24 Districts */
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Daftar 24 Kecamatan</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Klik kecamatan di bawah atau di peta untuk rincian
                    </p>
                  </div>

                  <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                    {apiData?.districts?.map((d) => {
                      const val =
                        metric === 'schools'
                          ? d.schools_count
                          : metric === 'ptk'
                          ? d.teachers_count + d.tendiks_count
                          : d.students_count;

                      return (
                        <button
                          key={d.kode}
                          onClick={() => setSelectedDistrict(d.nama)}
                          className="w-full text-left p-2.5 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all flex items-center justify-between group"
                        >
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-900">
                              {d.nama}
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {d.schools_count} Madrasah • {d.teachers_count} Guru • {d.tendiks_count} Tendik
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-100 text-slate-700 group-hover:bg-emerald-600 group-hover:text-white font-black text-[11px] px-2">
                              {val}
                            </Badge>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
