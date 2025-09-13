import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import PlaylistAddCheckCircleIcon from '@mui/icons-material/PlaylistAddCheckCircle';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axiosClient from '../api/axiosClient';

const StatCard = ({ icon, label, value, deltaText, deltaColor = 'success' }) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderRadius: 3,
      borderColor: 'divider',
      background: (theme) => theme.palette.mode === 'light'
        ? 'linear-gradient(180deg, rgba(2,6,23,0.02) 0%, rgba(2,6,23,0) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
      boxShadow: (theme) => `0 6px 16px ${theme.palette.mode==='light' ? 'rgba(2,6,23,0.05)' : 'rgba(0,0,0,0.35)'}`,
    }}
  >
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 2.5 }}>
      <Box sx={(theme)=>({
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 2,
        bgcolor: theme.palette.action.hover,
      })}>
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" fontWeight={800}>{value}</Typography>
        {deltaText && (
          <Typography variant="caption" sx={{ color: `${deltaColor}.main`, fontWeight: 600 }}>{deltaText}</Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Dashboard = () => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await axiosClient.get('/requests', { signal: controller.signal });
        setRows(Array.isArray(data?.data || data) ? (data.data || data) : []);
      } catch (e) {
        setRows([]);
      }
    })();
    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const totalRequests = rows.length;
    const pending = rows.filter(r => String(r.status).toLowerCase() === 'pending').length;
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

    // This month amount
    const now = new Date();
    const thisMonthAmount = rows
      .filter(r => r.date && (new Date(r.date)).getMonth() === now.getMonth() && (new Date(r.date)).getFullYear() === now.getFullYear())
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    return { totalRequests, pending, totalAmount, thisMonthAmount };
  }, [rows]);

  const monthlySeries = useMemo(() => {
    // Sum by month for current year
    const byMonth = new Array(12).fill(0);
    const year = new Date().getFullYear();
    rows.forEach(r => {
      const d = r.date ? new Date(r.date) : null;
      if (d && d.getFullYear() === year) byMonth[d.getMonth()] += Number(r.amount || 0);
    });
    return byMonth;
  }, [rows]);

  const categorySeries = useMemo(() => {
    const map = new Map();
    rows.forEach(r => {
      const key = r.category || 'Other';
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
    });
    const total = Array.from(map.values()).reduce((a,b)=>a+b,0) || 1;
    return Array.from(map.entries()).map(([name, value]) => ({ name, value, pct: (value/total)*100 }));
  }, [rows]);

  // Simple SVG line chart data
  const LineChart = ({ data, width=520, height=260, stroke='#1976d2' }) => {
    const max = Math.max(...data, 1);
    const pad = 30; // padding for axes
    const w = width - pad*2;
    const h = height - pad*2;
    const points = data.map((v,i)=>{
      const x = pad + (i*(w/(data.length-1 || 1)));
      const y = pad + (h - (v/max)*h);
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} role="img" aria-label="Monthly Trends">
        <rect x={0} y={0} width={width} height={height} fill="#fff" stroke="#eee" />
        {/* axes */}
        <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#ccc" />
        <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#ccc" />
        {/* grid */}
        {[0,0.25,0.5,0.75,1].map((t,idx)=>{
          const y = pad + (h*(1-t));
          return <line key={idx} x1={pad} y1={y} x2={width-pad} y2={y} stroke="#f0f0f0" />
        })}
        {/* polyline */}
        <polyline fill="none" stroke={stroke} strokeWidth={2} points={points} />
        {/* points */}
        {data.map((v,i)=>{
          const x = pad + (i*(w/(data.length-1 || 1)));
          const y = pad + (h - (v/Math.max(max,1))*h);
          return <circle key={i} cx={x} cy={y} r={3} fill={stroke} />
        })}
      </svg>
    );
  };

  const PieChart = ({ series, width=360, height=260 }) => {
    const cx = width/2, cy = height/2, r = Math.min(width,height)/3;
    let startAngle = -Math.PI/2;
    const colors = ['#1976d2','#2e7d32','#ed6c02','#9c27b0','#607d8b','#ef5350'];
    const arcs = series.map((s,idx)=>{
      const angle = (s.pct/100)*2*Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const path = <path key={idx} d={d} fill={colors[idx % colors.length]} stroke="#fff" strokeWidth={1} />;
      startAngle = endAngle;
      return path;
    });
    return (
      <svg width={width} height={height} role="img" aria-label="Category Breakdown">
        <rect x={0} y={0} width={width} height={height} fill="#fff" stroke="#eee" />
        {arcs}
      </svg>
    );
  };

  const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(n||0));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Welcome */}
      <Box>
        <Typography variant="h4" fontWeight={800}>Welcome back, Admin!</Typography>
        <Typography variant="body2" color="text.secondary">Here's your petty cash management overview for today.</Typography>
      </Box>

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          alignItems: 'stretch',
        }}
      >
        <StatCard icon={<PlaylistAddCheckCircleIcon color="primary" />} label="Total Requests" value={stats.totalRequests} deltaText="↑ 8.2% from last month" />
        <StatCard icon={<AccessTimeOutlinedIcon color="warning" />} label="Pending Approval" value={stats.pending} deltaText="↓ 2.4% from last month" deltaColor="error" />
        <StatCard icon={<AttachMoneyIcon color="success" />} label="Total Amount" value={fmt(stats.totalAmount)} deltaText="↑ 12.5% from last month" />
        <StatCard icon={<TrendingUpIcon color="secondary" />} label="This Month" value={fmt(stats.thisMonthAmount)} deltaText="↑ 5.7% from last month" />
      </Box>

      {/* Charts */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>Monthly Trends</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>Requests and amounts over time</Typography>
              <LineChart data={monthlySeries} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, mx: 4 }}>
                {months.map((m,i)=> (
                  <Typography key={i} variant="caption" color="text.secondary">{m}</Typography>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>Category Breakdown</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>Expenses by category this month</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                <PieChart series={categorySeries} />
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {categorySeries.slice(0,6).map((c, idx) => (
                    <Chip key={c.name+idx} label={`${c.name} ${Math.round(c.pct)}%`} variant="outlined" />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
