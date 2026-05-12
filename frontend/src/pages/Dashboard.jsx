import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  useTheme,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
} from '@mui/material';
import PlaylistAddCheckCircleIcon from '@mui/icons-material/PlaylistAddCheckCircle';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import axiosClient from '../api/axiosClient';
import { useRegionalSettings } from '../hooks/useRegionalSettings';

const StatCard = ({ icon, label, value, deltaText, deltaColor = 'success' }) => (
  <Card
    variant="outlined"
    sx={{
      height: '100%',
      borderRadius: 2,
      borderColor: 'divider',
      background: (theme) => theme.palette.mode === 'light'
        ? 'linear-gradient(135deg, rgba(25,118,210,0.03) 0%, rgba(255,255,255,0.8) 100%)'
        : 'linear-gradient(135deg, rgba(25,118,210,0.1) 0%, rgba(255,255,255,0.02) 100%)',
      boxShadow: (theme) => theme.palette.mode === 'light' 
        ? '0 2px 8px rgba(0,0,0,0.08)' 
        : '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'all 0.3s ease',
      '&:hover': {
        boxShadow: (theme) => theme.palette.mode === 'light'
          ? '0 4px 16px rgba(0,0,0,0.12)'
          : '0 4px 16px rgba(0,0,0,0.6)',
        transform: 'translateY(-2px)',
      }
    }}
  >
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.8125rem' }}>
          {label}
        </Typography>
        <Box sx={(theme)=>({
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'light' ? 'rgba(25,118,210,0.08)' : 'rgba(25,118,210,0.15)',
        })}>
          {React.cloneElement(icon, { sx: { fontSize: 24 } })}
        </Box>
      </Box>
      <Box>
        <Box sx={{ minHeight: 60, display: 'flex', alignItems: 'center' }}>
          {typeof value === 'string' || typeof value === 'number' ? (
            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              {value}
            </Typography>
          ) : (
            value
          )}
        </Box>
        {deltaText && (
          <Typography variant="caption" sx={{ color: `${deltaColor}.main`, fontWeight: 600, mt: 0.5, display: 'block' }}>
            {deltaText}
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const Dashboard = () => {
  const [rows, setRows] = useState([]);
  const [travelCostSummary, setTravelCostSummary] = useState(null);
  const [travelRequests, setTravelRequests] = useState([]);
  const [taskTab, setTaskTab] = useState(0); // 0 = Overdue, 1 = In Progress
  const { currency, formatCurrency } = useRegionalSettings();

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { data } = await axiosClient.get('/requests', {
          signal: controller.signal,
          params: { limit: 10000 }
        });
        setRows(Array.isArray(data?.data || data) ? (data.data || data) : []);
      } catch (e) {
        setRows([]);
      }
    })();

    // Fetch travel cost summary for cancellation charges
    (async () => {
      try {
        const { data } = await axiosClient.get('/travel-costs/summary');
        setTravelCostSummary(data?.data || null);
      } catch (e) {
        setTravelCostSummary(null);
      }
    })();

    // Fetch travel requests for In Progress tab
    (async () => {
      try {
        const { data } = await axiosClient.get('/l1-approvals');
        setTravelRequests(data?.data || []);
      } catch (e) {
        setTravelRequests([]);
      }
    })();

    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    const totalRequests = rows.length;
    const pending = rows.filter(r => String(r.status).toLowerCase() === 'pending').length;
    
    // Group amounts by currency
    const byCurrency = {};
    rows.forEach(r => {
      const curr = r.currency || 'USD';
      if (!byCurrency[curr]) {
        byCurrency[curr] = { total: 0, thisMonth: 0 };
      }
      byCurrency[curr].total += Number(r.amount || 0);
    });

    // This month amounts by currency
    const now = new Date();
    rows
      .filter(r => r.date && (new Date(r.date)).getMonth() === now.getMonth() && (new Date(r.date)).getFullYear() === now.getFullYear())
      .forEach(r => {
        const curr = r.currency || 'USD';
        if (!byCurrency[curr]) {
          byCurrency[curr] = { total: 0, thisMonth: 0 };
        }
        byCurrency[curr].thisMonth += Number(r.amount || 0);
      });

    return { totalRequests, pending, byCurrency };
  }, [rows]);

  const taskSummary = useMemo(() => {
    const now = new Date();

    // Overdue: pending requests where date_of_purchase is in the past (older than 7 days with no action)
    const overdue = rows.filter(r => {
      if (String(r.status).toLowerCase() !== 'pending') return false;
      const d = r.dateOfPurchase ? new Date(r.dateOfPurchase) : (r.date ? new Date(r.date) : null);
      if (!d) return false;
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    });

    // In Progress: approved travel requests that are currently ongoing (departure <= today <= return)
    const inProgress = travelRequests.filter(r => {
      const td = r.travel_form_data;
      if (!td) return false;
      // Must be approved
      if (r.l1_approval_status !== 'approved') return false;

      let startDate = null;
      let endDate = null;

      if (td.travelType === 'domestic') {
        startDate = td.domesticDateFlexFrom || td.dateOfTravel;
        endDate = td.domesticDateFlexTo || td.dateOfTravel;
      } else if (td.tripType === 'multiCity' && td.multiCityLegs?.length) {
        startDate = td.multiCityLegs[0]?.date;
        endDate = td.multiCityLegs[td.multiCityLegs.length - 1]?.date;
      } else {
        startDate = td.roundTrip?.departureDate || td.dateOfTravel;
        endDate = td.roundTrip?.arrivalDate || td.dateOfTravel;
      }

      if (!startDate) return false;
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(startDate);
      end.setHours(23, 59, 59, 999);
      return now >= start && now <= end;
    });

    // Also include pending_l1 travel requests as "In Progress" (awaiting approval)
    const pendingL1 = travelRequests.filter(r =>
      r.status === 'pending_l1' || r.l1_approval_status === 'pending'
    );

    return { overdue, inProgress: [...inProgress, ...pendingL1] };
  }, [rows, travelRequests]);

  const monthlySeries = useMemo(() => {
    // Sum by month for current year, handling multiple currencies
    const byMonth = new Array(12).fill(0);
    const year = new Date().getFullYear();
    
    rows.forEach(r => {
      const d = r.date ? new Date(r.date) : null;
      if (d && d.getFullYear() === year) {
        // Store amount in original currency - no conversion
        byMonth[d.getMonth()] += Number(r.amount || 0);
      }
    });
    return byMonth;
  }, [rows]);

  const categorySeries = useMemo(() => {
    const map = new Map();

    // Group petty cash requests by category, but exclude Travel Request
    // (travel costs are broken down separately from the summary)
    rows.forEach(r => {
      const key = r.category || r.category_name || 'Other';
      if (key === 'Travel Request' || key === 'Travel') return; // handled via travel cost summary
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
    });

    // Add travel cost breakdown from summary as dedicated slices
    if (travelCostSummary) {
      const travelComponents = [
        { key: 'Flights',               field: 'total_flights'    },
        { key: 'Hotel',                 field: 'total_hotel'      },
        { key: 'Transport',             field: 'total_transport'  },
        { key: 'Food (Travel)',         field: 'total_food'       },
        { key: 'Car Park',              field: 'total_car_park'   },
        { key: 'Visa',                  field: 'total_visa'       },
        { key: 'Baggage',               field: 'total_baggage'    },
        { key: 'Other (Travel)',        field: 'total_other'      },
        { key: 'Cancellation Charges',  field: 'total_cancellation' },
      ];
      travelComponents.forEach(({ key, field }) => {
        const val = parseFloat(travelCostSummary[field] || 0);
        if (val > 0) {
          map.set(key, (map.get(key) || 0) + val);
        }
      });
    }

    const total = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]) // largest slice first
      .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));
  }, [rows, travelCostSummary]);

  // Responsive SVG line chart
  const LineChart = ({ data, height=260, stroke='#1976d2' }) => {
    const theme = useTheme();
    const containerRef = React.useRef(null);
    const [width, setWidth] = React.useState(520);

    React.useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width || 520);
        }
      });
      ro.observe(containerRef.current);
      setWidth(containerRef.current.offsetWidth || 520);
      return () => ro.disconnect();
    }, []);

    const max = Math.max(...data, 1);
    const pad = 36;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = data.map((v, i) => {
      const x = pad + (i * (w / (data.length - 1 || 1)));
      const y = pad + (h - (v / max) * h);
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = points + ` ${pad + w},${height - pad} ${pad},${height - pad}`;

    const bg = theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fff';
    const axis = theme.palette.divider;
    const grid = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
    const gradientId = 'chart-gradient';

    return (
      <Box ref={containerRef} sx={{ width: '100%' }}>
        <svg width={width} height={height} role="img" aria-label="Monthly Trends" style={{ display: 'block' }}>
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={width} height={height} fill={bg} stroke={axis} />
          {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
            const y = pad + (h * (1 - t));
            return (
              <g key={idx}>
                <line x1={pad} y1={y} x2={width - pad} y2={y} stroke={grid} strokeDasharray="2,2" />
                <text x={pad - 4} y={y + 3} textAnchor="end" fill={theme.palette.text.secondary} fontSize="9">
                  {Math.round(max * t)}
                </text>
              </g>
            );
          })}
          <polygon points={areaPoints} fill={`url(#${gradientId})`} opacity={0.8} />
          <polyline fill="none" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
          {data.map((v, i) => {
            const x = pad + (i * (w / (data.length - 1 || 1)));
            const y = pad + (h - (v / Math.max(max, 1)) * h);
            const hasData = v > 0;
            return (
              <g key={i}>
                {hasData && <circle cx={x} cy={y} r={5} fill={stroke} opacity={0.2} />}
                <circle cx={x} cy={y} r={hasData ? 3.5 : 2} fill={hasData ? stroke : theme.palette.text.disabled} stroke={bg} strokeWidth={1.5} />
              </g>
            );
          })}
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke={axis} strokeWidth={1.5} />
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={axis} strokeWidth={1.5} />
        </svg>
      </Box>
    );
  };

  const PieChart = ({ series, size = 220 }) => {
    const theme = useTheme();
    const width = size, height = size;
    const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 2.8;
    let startAngle = -Math.PI / 2;
    const SLICE_COLORS = {
      'Flights': '#1976d2', 'Hotel': '#2e7d32', 'Transport': '#ed6c02',
      'Food (Travel)': '#00acc1', 'Car Park': '#7cb342', 'Visa': '#9c27b0',
      'Baggage': '#f57c00', 'Other (Travel)': '#607d8b', 'Cancellation Charges': '#ef5350',
    };
    const fallbackColors = ['#1976d2','#2e7d32','#ed6c02','#9c27b0','#607d8b','#00acc1','#7cb342','#f57c00','#5e35b1','#0288d1'];
    const arcs = series.map((s, idx) => {
      const color = SLICE_COLORS[s.name] || fallbackColors[idx % fallbackColors.length];
      const angle = (s.pct / 100) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      const path = <path key={idx} d={d} fill={color} stroke="#fff" strokeWidth={1} />;
      startAngle = endAngle;
      return path;
    });
    const bg = theme.palette.mode === 'dark' ? theme.palette.background.paper : '#fff';
    return (
      <svg width={width} height={height} role="img" aria-label="Current Spending Overview" style={{ flexShrink: 0 }}>
        <rect x={0} y={0} width={width} height={height} fill={bg} />
        {arcs}
      </svg>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Welcome */}
      <Box>
        <Typography variant="h4" fontWeight={800}>Welcome back, Admin!</Typography>
        <Typography variant="body2" color="text.secondary">Here's your PocketPro HR overview for today.</Typography>
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
        <StatCard 
          icon={<PlaylistAddCheckCircleIcon color="primary" />} 
          label="Total Requests" 
          value={stats.totalRequests} 
        />
        <StatCard 
          icon={<AccessTimeOutlinedIcon color="warning" />} 
          label="Pending Approval" 
          value={stats.pending} 
        />
        <StatCard 
          icon={<AccountBalanceWalletIcon color="success" />} 
          label="Total Amount" 
          value={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {Object.entries(stats.byCurrency).map(([curr, data]) => (
                <Box key={curr} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                  <Typography variant="h6" component="span" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                    {formatCurrency(data.total, curr)}
                  </Typography>
                  <Typography variant="caption" component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                    {curr}
                  </Typography>
                </Box>
              ))}
              {Object.keys(stats.byCurrency).length === 0 && (
                <Typography variant="h6" fontWeight={700}>
                  {formatCurrency(0, currency)}
                </Typography>
              )}
            </Box>
          }
        />
        <StatCard 
          icon={<TrendingUpIcon color="secondary" />} 
          label="This Month" 
          value={
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {Object.entries(stats.byCurrency).map(([curr, data]) => (
                data.thisMonth > 0 && (
                  <Box key={curr} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                    <Typography variant="h6" component="span" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                      {formatCurrency(data.thisMonth, curr)}
                    </Typography>
                    <Typography variant="caption" component="span" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: '0.7rem' }}>
                      {curr}
                    </Typography>
                  </Box>
                )
              ))}
              {Object.values(stats.byCurrency).every(d => d.thisMonth === 0) && (
                <Typography variant="h6" fontWeight={700}>
                  {formatCurrency(0, currency)}
                </Typography>
              )}
            </Box>
          }
        />
      </Box>

      {/* Charts */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={800} gutterBottom>Monthly Trends</Typography>
                  <Typography variant="body2" color="text.secondary">Requests and amounts over time (Mixed Currencies)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box 
                    sx={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%',
                      backgroundColor: '#4caf50',
                      animation: 'pulse 2s infinite'
                    }} 
                  />
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    Live Data
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ position: 'relative', width: '100%', mb: 1 }}>
                <LineChart data={monthlySeries} />
              </Box>
              
              {/* Month labels — show abbreviated on mobile */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: { xs: 0.5, sm: 2 } }}>
                {months.map((m, i) => {
                  const hasData = monthlySeries[i] > 0;
                  return (
                    <Box key={i} sx={{ textAlign: 'center', flex: 1 }}>
                      <Typography
                        variant="caption"
                        color={hasData ? 'text.primary' : 'text.disabled'}
                        sx={{ fontWeight: hasData ? 600 : 400, display: 'block', fontSize: { xs: '0.6rem', sm: '0.75rem' } }}
                      >
                        {m}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={800} gutterBottom>Current Spending Overview</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>Expenses by category — including cancellation charges</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                <PieChart series={categorySeries} size={200} />
                <Box sx={{ display: 'grid', gap: 1, maxHeight: 300, overflowY: 'auto', flex: 1, minWidth: 140 }}>
                  {categorySeries.map((c, idx) => {
                    const LEGEND_COLORS = {
                      'Flights':              '#1976d2',
                      'Hotel':                '#2e7d32',
                      'Transport':            '#ed6c02',
                      'Food (Travel)':        '#00acc1',
                      'Car Park':             '#7cb342',
                      'Visa':                 '#9c27b0',
                      'Baggage':              '#f57c00',
                      'Other (Travel)':       '#607d8b',
                      'Cancellation Charges': '#ef5350',
                    };
                    const fallbackLegendColors = [
                      '#1976d2', '#2e7d32', '#ed6c02', '#9c27b0',
                      '#607d8b', '#00acc1', '#7cb342', '#f57c00', '#5e35b1', '#0288d1',
                    ];
                    const isCancellation = c.name === 'Cancellation Charges';
                    const color = LEGEND_COLORS[c.name] || fallbackLegendColors[idx % fallbackLegendColors.length];
                    return (
                      <Box
                        key={c.name + idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          border: `1px solid ${color}30`,
                          backgroundColor: isCancellation ? `${color}12` : `${color}08`,
                        }}
                      >
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: isCancellation ? 0 : '50%', // diamond-ish for cancellation
                            backgroundColor: color,
                            flexShrink: 0,
                            transform: isCancellation ? 'rotate(45deg)' : 'none',
                          }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              color,
                              fontWeight: isCancellation ? 700 : 500,
                              fontSize: '0.8125rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                            {Math.round(c.pct)}% · {formatCurrency(c.value, currency)}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                  {categorySeries.length === 0 && (
                    <Typography variant="caption" color="text.secondary">No spending data yet.</Typography>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Currency Breakdown Card */}
        <Grid item xs={12}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1.125rem' }}>
                  Currency Breakdown
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                  Total amounts by currency
                </Typography>
              </Box>
              <Grid container spacing={2.5}>
                {Object.entries(stats.byCurrency).map(([curr, data]) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={curr}>
                    <Card 
                      variant="outlined" 
                      sx={{ 
                        p: 2.5, 
                        borderRadius: 2,
                        borderColor: 'primary.main',
                        borderWidth: 1.5,
                        background: (theme) => theme.palette.mode === 'light'
                          ? 'linear-gradient(135deg, rgba(25,118,210,0.04) 0%, rgba(25,118,210,0.01) 100%)'
                          : 'linear-gradient(135deg, rgba(25,118,210,0.12) 0%, rgba(25,118,210,0.04) 100%)',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: 'primary.dark',
                          boxShadow: '0 4px 12px rgba(25,118,210,0.15)',
                          transform: 'translateY(-2px)',
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ fontSize: '2rem' }}>
                          {curr}
                        </Typography>
                        <Chip 
                          label={`${rows.filter(r => r.currency === curr).length} req`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                          Total Amount
                        </Typography>
                        <Typography variant="h5" fontWeight={700} color="success.main" sx={{ fontSize: '1.5rem' }}>
                          {formatCurrency(data.total, curr)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontSize: '0.75rem', fontWeight: 500 }}>
                          This Month
                        </Typography>
                        <Typography variant="h6" fontWeight={600} color="secondary.main" sx={{ fontSize: '1.125rem' }}>
                          {formatCurrency(data.thisMonth, curr)}
                        </Typography>
                      </Box>
                    </Card>
                  </Grid>
                ))}
                {Object.keys(stats.byCurrency).length === 0 && (
                  <Grid item xs={12}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        No data available yet. Start by creating some requests!
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
